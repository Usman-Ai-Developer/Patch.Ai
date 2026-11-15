def write_postcss_config(frontend_dir):
    content = '''export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
'''
    (frontend_dir / "postcss.config.js").write_text(content, encoding='utf-8')