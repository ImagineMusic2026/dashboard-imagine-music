/**
 * Tipos mínimos para `ssh2-sftp-client` (o pacote não traz `.d.ts`).
 * Cobre só o que os scripts de sync/inventário usam.
 */
declare module 'ssh2-sftp-client' {
  export interface FileInfo {
    type: 'd' | '-' | 'l'
    name: string
    size: number
    modifyTime: number
    accessTime: number
  }
  export interface ConnectOptions {
    host?: string
    port?: number
    username?: string
    privateKey?: Buffer | string
    passphrase?: string
    password?: string
    readyTimeout?: number
    [k: string]: unknown
  }
  export default class SftpClient {
    constructor(name?: string)
    connect(options: ConnectOptions): Promise<unknown>
    list(remotePath: string): Promise<FileInfo[]>
    get(
      remotePath: string,
      dst?: string | NodeJS.WritableStream,
    ): Promise<Buffer | NodeJS.WritableStream | string>
    end(): Promise<void>
  }
}
