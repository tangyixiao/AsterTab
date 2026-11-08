export type CalcResult =
  | { kind: "ok"; value: number; display: string }
  | { kind: "error"; message: string };

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; name: string }
  | { type: "symbol"; value: string };

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
};

export function evaluateExpression(expression: string): CalcResult {
  if (!expression.trim()) return { kind: "error", message: "Empty expression" };
  try {
    const value = parse(tokenize(expression));
    if (!Number.isFinite(value)) return { kind: "error", message: "Result is not finite" };
    return { kind: "ok", value, display: format(value) };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : "Invalid expression" };
  }
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const number = /\d+(?:\.\d+)?|\.\d+/y;
  const identifier = /[a-z]+/iy;
  let index = 0;
  while (index < expression.length) {
    const char = expression[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    number.lastIndex = index;
    const numberMatch = number.exec(expression);
    if (numberMatch) {
      tokens.push({ type: "number", value: Number.parseFloat(numberMatch[0]) });
      index = number.lastIndex;
      continue;
    }
    identifier.lastIndex = index;
    const identifierMatch = identifier.exec(expression);
    if (identifierMatch) {
      tokens.push({ type: "identifier", name: identifierMatch[0] });
      index = identifier.lastIndex;
      continue;
    }
    if ("+-*/%^(),.".includes(char)) {
      tokens.push({ type: "symbol", value: char });
      index += 1;
      continue;
    }
    throw new Error(`Invalid character: ${char}`);
  }
  return tokens;
}

function parse(tokens: Token[]): number {
  let position = 0;
  const symbol = (value: string) => {
    const token = tokens[position];
    return token?.type === "symbol" && token.value === value ? token : undefined;
  };
  const additive = (): number => {
    let value = multiplicative();
    for (;;) {
      const operator = symbol("+") ?? symbol("-");
      if (!operator) return value;
      position += 1;
      const right = multiplicative();
      value = operator.value === "+" ? value + right : value - right;
    }
  };
  const multiplicative = (): number => {
    let value = unary();
    for (;;) {
      const operator = symbol("*") ?? symbol("/") ?? symbol("%");
      if (!operator) return value;
      position += 1;
      const right = unary();
      if ((operator.value === "/" || operator.value === "%") && right === 0) throw new Error("Cannot divide by zero");
      value = operator.value === "*" ? value * right : operator.value === "/" ? value / right : value % right;
    }
  };
  const unary = (): number => {
    const operator = symbol("+") ?? symbol("-");
    if (!operator) return power();
    position += 1;
    const value = unary();
    return operator.value === "+" ? value : -value;
  };
  const power = (): number => {
    const base = primary();
    if (!symbol("^")) return base;
    position += 1;
    return base ** unary();
  };
  const primary = (): number => {
    const token = tokens[position];
    if (!token) throw new Error("Invalid expression");
    if (token.type === "number") {
      position += 1;
      return token.value;
    }
    if (token.type === "identifier") {
      position += 1;
      if (!symbol("(")) {
        const constant = CONSTANTS[token.name.toLowerCase()];
        if (constant === undefined) throw new Error(`Unknown identifier: ${token.name}`);
        return constant;
      }
      position += 1;
      const args: number[] = [];
      if (!symbol(")")) {
        args.push(additive());
        while (symbol(",")) {
          position += 1;
          args.push(additive());
        }
      }
      if (!symbol(")")) throw new Error("Invalid expression");
      position += 1;
      return applyFunction(token.name, args);
    }
    if (token.type === "symbol" && token.value === "(") {
      position += 1;
      const value = additive();
      if (!symbol(")")) throw new Error("Invalid expression");
      position += 1;
      return value;
    }
    throw new Error("Invalid expression");
  };
  const value = additive();
  if (position !== tokens.length) throw new Error("Invalid expression");
  return value;
}

function applyFunction(name: string, args: number[]): number {
  const key = name.toLowerCase();
  const fn = FUNCTIONS[key];
  if (!fn) throw new Error(`Unknown function: ${name}`);
  if (key === "min" || key === "max") {
    if (args.length < 2) throw new Error(`${name}() expects at least 2 arguments`);
  } else if (args.length !== 1) {
    throw new Error(`${name}() expects 1 argument`);
  }
  return fn(...args);
}

function format(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 2 ** 53) return String(value);
  return String(Number.parseFloat(value.toPrecision(12)));
}
