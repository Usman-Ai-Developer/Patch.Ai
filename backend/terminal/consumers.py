# terminal/consumers.py
import os
import json
import threading
import subprocess
import sys
import logging
from urllib.parse import parse_qs
from pathlib import Path

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

if sys.platform == "win32":
    try:
        from winpty import PtyProcess
        WINPTY_AVAILABLE = True
    except ImportError:
        WINPTY_AVAILABLE = False
        logger.warning("pywinpty not installed. Terminal will fall back to subprocess pipes.")
else:
    import pty

READ_CHUNK_SIZE = 8192
DEFAULT_COLS = 80
DEFAULT_ROWS = 24


class TerminalConsumer(AsyncWebsocketConsumer):
    def is_process_alive(self):
        if self.process is None:
            return False
        if sys.platform == "win32" and WINPTY_AVAILABLE:
            try:
                return self.process.isalive()
            except Exception:
                return False
        else:
            return self.process.poll() is None

    async def connect(self):
        self.process = None
        self.master_fd = None  # Unix PTY master fd

        from django.contrib.auth.models import AnonymousUser
        from django.apps import apps
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        query_string = self.scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        try:
            self.init_cols = int(query_params.get('cols', [DEFAULT_COLS])[0])
            self.init_rows = int(query_params.get('rows', [DEFAULT_ROWS])[0])
        except (TypeError, ValueError):
            self.init_cols, self.init_rows = DEFAULT_COLS, DEFAULT_ROWS

        if token:
            try:
                access = AccessToken(token)
                User = get_user_model()
                user = await database_sync_to_async(User.objects.get)(id=access.payload['user_id'])
                self.scope['user'] = user
                logger.info(f"Authenticated user: {user.username}")
            except (InvalidToken, TokenError, User.DoesNotExist) as e:
                logger.warning(f"Token validation failed: {e}")
                self.scope['user'] = AnonymousUser()
        else:
            logger.warning("No token provided")
            self.scope['user'] = AnonymousUser()

        self.user = self.scope['user']

        if not self.user.is_authenticated:
            logger.warning("User not authenticated, rejecting connection")
            await self.close()
            return

        self.project_id = self.scope['url_route']['kwargs']['project_id']
        logger.info(f"WebSocket connect attempt for project {self.project_id} by user {self.user}")

        Project = apps.get_model('assistant', 'Project')
        try:
            self.project = await database_sync_to_async(Project.objects.get)(
                id=self.project_id, owner=self.user
            )
        except Project.DoesNotExist:
            logger.error(f"Project {self.project_id} not found or not owned by user")
            await self.close()
            return

        logger.info("Project found, accepting connection")
        await self.accept()

        try:
            await self.start_shell()
            logger.info("Shell started successfully")
        except Exception as e:
            logger.error(f"Failed to start shell: {e}")
            await self.send(text_data=json.dumps({
                'type': 'output',
                'data': f'\r\n\x1b[31mFailed to start shell: {str(e)}\x1b[0m\r\n'
            }))
            await self.close(code=1011)

    async def disconnect(self, close_code):
        if self.is_process_alive():
            try:
                if sys.platform != "win32":
                    import os
                    import signal
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                else:
                    self.process.terminate()
                self.process.wait(timeout=3)
            except Exception as e:
                logger.error(f"Error during process termination: {e}")
                try:
                    self.process.kill()
                except Exception:
                    pass
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
        logger.info(f"WebSocket disconnected with code {close_code}")

    async def start_shell(self):
        from assistant.file_ops import project_dir
        workspace = project_dir(self.project)
        workspace.mkdir(parents=True, exist_ok=True)

        items = list(workspace.iterdir())
        target_cwd = workspace
        dirs = [item for item in items if item.is_dir()]
        files = [item for item in items if item.is_file()]
        logger.info(f"Workspace contents: {len(dirs)} directories, {len(files)} files")

        if len(dirs) == 1 and len(files) == 0:
            target_cwd = dirs[0]
            logger.info(f"Auto‑changed directory to: {target_cwd}")
        else:
            logger.info(f"Keeping workspace root: {workspace}")

        env = os.environ.copy()
        env['TERM'] = 'xterm-256color'
        env['COLORTERM'] = 'truecolor'

        if sys.platform == "win32":
            env['PROMPT'] = 'patch/: $p$g '
            shell_cmd = ['cmd.exe', '/Q', '/K', 'prompt patch/: $p$g']
        else:
            env['PS1'] = (
                '\\[\\e[38;5;39m\\]patch/\\[\\e[0m\\] '
                '\\[\\e[38;5;244m\\]\\w\\[\\e[0m\\] '
                '\\[\\e[38;5;39m\\]$\\[\\e[0m\\] '
            )
            shell_cmd = ['/bin/bash', '--norc', '--noprofile']

        env['HOME'] = str(target_cwd)

        if sys.platform == "win32" and WINPTY_AVAILABLE:
            try:
                self.process = PtyProcess.spawn(
                    shell_cmd,
                    cwd=str(target_cwd),
                    env=env,
                    dimensions=(self.init_rows, self.init_cols),
                )
                self.output_thread = threading.Thread(target=self.read_output_winpty)
                self.output_thread.daemon = True
                self.output_thread.start()
                logger.info("Windows PTY started successfully")
            except Exception as e:
                logger.error(f"Winpty spawn failed: {e}")
                self.process = subprocess.Popen(
                    shell_cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    cwd=str(target_cwd),
                    env=env,
                    bufsize=0,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                )
                self.output_thread = threading.Thread(target=self.read_output_pipe)
                self.output_thread.daemon = True
                self.output_thread.start()
                logger.warning("Falling back to subprocess pipes for Windows")
        elif sys.platform == "win32":
            self.process = subprocess.Popen(
                shell_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                cwd=str(target_cwd),
                env=env,
                bufsize=0,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            self.output_thread = threading.Thread(target=self.read_output_pipe)
            self.output_thread.daemon = True
            self.output_thread.start()
            logger.info("Windows subprocess pipe started")
        else:
            # ─── Unix PTY ─────────────────────────────────────────────
            import pty
            import fcntl
            import struct
            import termios

            master_fd, slave_fd = pty.openpty()
            self._set_winsize(master_fd, self.init_rows, self.init_cols)
            self.process = subprocess.Popen(
                shell_cmd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=str(target_cwd),
                env=env,
                preexec_fn=os.setsid,
                close_fds=True,
            )
            os.close(slave_fd)
            self.master_fd = master_fd
            self.output_thread = threading.Thread(target=self.read_output_unix)
            self.output_thread.daemon = True
            self.output_thread.start()
            logger.info("Unix PTY started")

    def _set_winsize(self, fd, rows, cols):
        try:
            import fcntl, struct, termios
            winsize = struct.pack('HHHH', rows, cols, 0, 0)
            fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
        except Exception as e:
            logger.warning(f"Failed to set winsize: {e}")

    def read_output_winpty(self):
        try:
            while True:
                data = self.process.read(READ_CHUNK_SIZE)
                if not data:
                    break
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                async_to_sync(get_channel_layer().send)(
                    self.channel_name,
                    {'type': 'terminal.output', 'data': data}
                )
        except Exception as e:
            logger.error(f"Winpty read error: {e}")

    def read_output_pipe(self):
        try:
            while True:
                output = self.process.stdout.read(READ_CHUNK_SIZE)
                if not output:
                    break
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                async_to_sync(get_channel_layer().send)(
                    self.channel_name,
                    {'type': 'terminal.output', 'data': output.decode('utf-8', errors='ignore')}
                )
        except Exception as e:
            logger.error(f"Pipe read error: {e}")

    def read_output_unix(self):
        while True:
            try:
                output = os.read(self.master_fd, READ_CHUNK_SIZE)
                if not output:
                    break
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                async_to_sync(get_channel_layer().send)(
                    self.channel_name,
                    {'type': 'terminal.output', 'data': output.decode('utf-8', errors='ignore')}
                )
            except OSError:
                break
            except Exception as e:
                logger.error(f"Unix read error: {e}")
                break

    async def terminal_output(self, event):
        await self.send(text_data=json.dumps({'type': 'output', 'data': event['data']}))

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')

            if msg_type == 'input':
                if self.is_process_alive():
                    if sys.platform == "win32" and WINPTY_AVAILABLE:
                        self.process.write(data['data'])
                    elif sys.platform == "win32":
                        self.process.stdin.write(data['data'].encode())
                        self.process.stdin.flush()
                    else:
                        os.write(self.master_fd, data['data'].encode())
                else:
                    logger.warning("Process is not alive, ignoring input")

            elif msg_type == 'resize':
                cols = int(data.get('cols', DEFAULT_COLS))
                rows = int(data.get('rows', DEFAULT_ROWS))
                if sys.platform == "win32" and WINPTY_AVAILABLE and self.process:
                    try:
                        self.process.setwinsize(rows, cols)
                    except Exception as e:
                        logger.warning(f"Winpty resize failed: {e}")
                elif sys.platform != "win32" and self.master_fd is not None:
                    self._set_winsize(self.master_fd, rows, cols)
        except Exception as e:
            logger.error(f"Receive error: {e}")