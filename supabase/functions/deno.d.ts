declare namespace Deno {
  interface Env {
    get(name: string): string | undefined;
  }

  const env: Env;

  function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}
