import { LessonStudioPage } from "@/components/app-shell";
import { getUploadConfig } from "@/lib/upload/config";

export default function CreatePage() {
  return <LessonStudioPage maxUploadBytes={getUploadConfig().maxBytes} />;
}
