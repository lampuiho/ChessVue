export class SerializationError extends Error {
  public readonly causeDetail: unknown

  public constructor(message: string, causeDetail?: unknown) {
    super(message)
    this.name = 'SerializationError'
    this.causeDetail = causeDetail ?? null
  }
}
