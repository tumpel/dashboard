export const githubApi =
  (token, transport = fetch) =>
  async (path, options = {}) => {
    const response = await transport(new URL(path, "https://api.github.com"), {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `GitHub ${options.method ?? "GET"} ${path} failed (${response.status}). Check the token permissions and request before retrying.`,
      );
    return response.status === 204 ? null : response.json();
  };
