export class IntakeSaveUnconfirmedError extends Error {
  constructor() {
    super('The save is taking too long to confirm. Your entries remain here. Keep this tab open and check the household’s saved intakes in another tab before trying again; the save may still finish.')
    this.name = 'IntakeSaveUnconfirmedError'
  }
}

/** A timeout cannot prove a write failed. Never retry it automatically. */
export async function withIntakeSaveDeadline<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IntakeSaveUnconfirmedError()), 30_000)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
