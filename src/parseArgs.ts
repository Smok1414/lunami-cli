export interface ParsedArgs {
  prompt?: string;
  run?: string;
  help: boolean;
  version: boolean;
  plan: boolean;
  yolo: boolean;
  dryRun: boolean;
  update: boolean;
  yes: boolean;
  maxRounds: number;
  cwd?: string;
  sessionId?: string;
  model?: string;
  json: boolean;
  noColor: boolean;
  verbose: boolean;
  debug: boolean;
  quiet: boolean;
  rest: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    help: false,
    version: false,
    plan: false,
    yolo: false,
    dryRun: false,
    update: false,
    yes: false,
    json: false,
    noColor: false,
    verbose: false,
    debug: false,
    quiet: false,
    maxRounds: 30,
    rest: [],
  };

  let i = 0;
  while (i < args.length) {
    const a = args[i];

    const next = () => {
      i++;
      if (i >= args.length) {
        throw new ParseArgsError(`flag ${a} requires a value`);
      }
      return args[i];
    };

    switch (a) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--version':
      case '-v':
        result.version = true;
        break;
      case '--plan':
        result.plan = true;
        break;
      case '--yolo':
        result.yolo = true;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--update':
        result.update = true;
        break;
      case '--yes':
      case '-y':
        result.yes = true;
        break;
      case '--json':
        result.json = true;
        break;
      case '--no-color':
        result.noColor = true;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--debug':
        result.debug = true;
        break;
      case '--quiet':
      case '-q':
        result.quiet = true;
        break;
      case '--prompt':
      case '-p':
        result.prompt = next();
        break;
      case '--run':
        result.run = next();
        break;
      case '--cwd':
        result.cwd = next();
        break;
      case '--session':
        result.sessionId = next();
        break;
      case '--model':
        result.model = next();
        break;
      case '--max-rounds': {
        const n = parseInt(next(), 10);
        if (Number.isNaN(n) || n < 1) {
          throw new ParseArgsError('--max-rounds must be positive');
        }
        result.maxRounds = n;
        break;
      }
      default:
        if (a === 'update') {
          result.update = true;
          break;
        }
        result.rest.push(a);
    }
    i++;
  }

  return result;
}

export class ParseArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseArgsError';
  }
}

export function isAutoApproveWrites(yesFlag = false): boolean {
  return (
    yesFlag ||
    process.env.LUNAMI_YES === '1' ||
    process.env.LUNAMI_AUTO_APPROVE_WRITES === '1'
  );
}
