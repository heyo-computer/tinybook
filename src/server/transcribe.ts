export type TranscribeRequest = {
  audio: Blob;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

export async function transcribe(req: TranscribeRequest): Promise<string> {
  const baseUrl = req.baseUrl?.trim() || DEFAULT_BASE_URL;
  const fd = new FormData();
  const filename = (req.audio as File).name || "audio.webm";
  fd.append("file", req.audio, filename);
  fd.append("model", req.model);

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${req.apiKey}` },
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral transcription error ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  return String(data.text ?? "");
}
