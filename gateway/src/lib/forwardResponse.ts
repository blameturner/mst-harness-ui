export async function forwardResponse(res: Response, tag?: string): Promise<Response> {
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  if (!res.ok) {
    console.error(
      `[${tag ?? 'harness'}] non-2xx response`,
      res.status,
      text.slice(0, 1000),
    );
  }
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}
