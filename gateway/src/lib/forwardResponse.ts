export async function forwardResponse(res: Response): Promise<Response> {
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}
