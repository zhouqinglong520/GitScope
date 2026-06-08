declare module 'xterm' {
  export interface ITerminalOptions {
    allowProposedApi?: boolean;
    allowTransparency?: boolean;
    altClickMovesCursor?: boolean;
    cursorBlink?: boolean;
    cursorStyle?: 'block' | 'underline' | 'bar';
    fontSize?: number;
    fontFamily?: string;
    theme?: ITheme;
    rows?: number;
    cols?: number;
    scrollback?: number;
    convertEol?: boolean;
    [key: string]: any;
  }

  export interface ITheme {
    foreground?: string;
    background?: string;
    cursor?: string;
    cursorAccent?: string;
    selection?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  }

  export interface IBufferNamespace {
    active: IBuffer;
  }

  export interface IBuffer {
    readonly length: number;
  }

  export default class Terminal {
    constructor(options?: ITerminalOptions);
    open(element: HTMLElement): void;
    write(data: string | Uint8Array): void;
    writeln(data: string): void;
    focus(): void;
    dispose(): void;
    reset(): void;
    clear(): void;
    resize(cols: number, rows: number): void;
    onData(callback: (data: string) => void): void;
    onResize(callback: (evt: { cols: number; rows: number }) => void): void;
    onKey(callback: (evt: { key: string; domEvent: KeyboardEvent }) => void): void;
    registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => void): number;
    deregisterLinkMatcher(id: number): void;
    buffer: IBufferNamespace;
    rows: number;
    cols: number;
    element: HTMLElement | undefined;
  }
}

declare module 'xterm-addon-fit' {
  import { Terminal } from 'xterm';
  export default class FitAddon {
    constructor();
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}

declare module 'xterm-addon-web-links' {
  import { Terminal } from 'xterm';
  export default class WebLinksAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void);
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}
