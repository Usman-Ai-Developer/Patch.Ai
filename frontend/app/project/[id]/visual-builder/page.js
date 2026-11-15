"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated } from "../../../../lib/auth";
import VisualBuilderApp from "../../../../components/visualbuilder/VisualBuilderApp";

export default function VisualBuilderPage() {
  const { id: projectId } = useParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return <VisualBuilderApp projectId={projectId} />;
}
