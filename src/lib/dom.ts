/* Small DOM helpers. The games are simple state machines; they do not need a
 * framework, only a tidy way to build elements. */

type Child = Node | string | null | undefined | false;

export interface Attrs {
  class?: string;
  text?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  vars?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: never) => void>>;
  [key: string]: unknown;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'vars') for (const [k, v] of Object.entries(value as Record<string, string>)) node.style.setProperty(k, v);
    else if (key === 'on') {
      for (const [type, fn] of Object.entries(value as Record<string, EventListener>)) {
        node.addEventListener(type, fn);
      }
    } else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export const clear = (node: Element): void => { node.replaceChildren(); };

/** restarts a CSS animation that is already on the element */
export function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const NS = 'http://www.w3.org/2000/svg';

/** an SVG element, as `el` makes an HTML one */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number> = {}, ...children: (SVGElement | null)[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const c of children) if (c) node.append(c);
  return node;
}
