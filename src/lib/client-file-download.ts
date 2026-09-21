"use client";

export class FileDownloadError extends Error {
  readonly retryAfterSeconds: number | null;
  readonly status: number;

  constructor(message: string, status: number, retryAfterSeconds: number | null) {
    super(message);
    this.name = "FileDownloadError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export async function downloadFile(url: string, fallbackFileName: string) {
  const response = await fetch(url, {
    credentials: "same-origin",
    method: "GET",
  });

  if (!response.ok || response.redirected) {
    throw await toDownloadError(response);
  }

  const contentDisposition = response.headers.get("content-disposition");

  if (!contentDisposition) {
    throw new FileDownloadError(
      "Nao foi possivel baixar o arquivo. Atualize a pagina e tente novamente.",
      response.status,
      null,
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = getFileName(contentDisposition) ?? fallbackFileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function fileDownloadErrorFeedback(error: unknown) {
  if (error instanceof FileDownloadError && error.status === 429) {
    return {
      description: error.message,
      duration: Math.max(
        3_800,
        Math.min((error.retryAfterSeconds ?? 0) * 1_000, 10_000),
      ),
      title: "Limite de exportacoes atingido",
    };
  }

  return {
    description:
      error instanceof Error
        ? error.message
        : "Nao foi possivel baixar o arquivo. Tente novamente.",
    duration: 5_000,
    title: "Falha ao exportar",
  };
}

async function toDownloadError(response: Response) {
  let message =
    response.status === 429
      ? "Muitas tentativas. Aguarde um momento e tente novamente."
      : "Nao foi possivel baixar o arquivo. Tente novamente.";

  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };

    if (typeof payload.error?.message === "string") {
      message = payload.error.message;
    }
  } catch {
    // Redirects and framework error pages are not JSON download responses.
  }

  const retryAfter = Number(response.headers.get("retry-after"));

  return new FileDownloadError(
    message,
    response.status,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  );
}

function getFileName(contentDisposition: string) {
  return /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
}
