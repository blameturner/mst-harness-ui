/** Forward a harness response, transforming the JSON body with a mapper. */
export async function forwardNormalised<T>(
  res: Response,
  transform: (body: Record<string, unknown>) => T,
): Promise<Response> {
  const text = await res.text();
  if (!res.ok) {
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }
  try {
    const json = JSON.parse(text);
    const transformed = transform(json);
    return new Response(JSON.stringify(transformed), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }
}
