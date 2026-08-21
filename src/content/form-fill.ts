import { FieldMapping, FillSnapshot, FillSnapshotItem } from "../libs/types";

type FillableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeForSelector(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function buildElementPathSelector(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const currentElement: Element = current;
    const tagName = currentElement.tagName.toLowerCase();
    let segment = tagName;
    const name = currentElement.getAttribute("name");

    if (name) {
      segment += `[name="${escapeForSelector(name)}"]`;
    }

    const parent: Element | null = currentElement.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter((node: Element) => node.tagName === currentElement.tagName);
      if (sameTagSiblings.length > 1) {
        segment += `:nth-of-type(${sameTagSiblings.indexOf(currentElement) + 1})`;
      }
    }

    segments.unshift(segment);
    current = parent;
  }

  return segments.join(" > ");
}

function getElementSelector(element: Element): string {
  const elementId = (element as HTMLElement).id;
  if (elementId) {
    return `#${escapeForSelector(elementId)}`;
  }

  const pathSelector = buildElementPathSelector(element);
  if (pathSelector) {
    return pathSelector;
  }

  return element.tagName.toLowerCase();
}

function findByLabel(labelText?: string): FillableElement | null {
  const normalizedLabel = normalizeText(labelText);
  if (!normalizedLabel) {
    return null;
  }

  const labels = Array.from(document.querySelectorAll("label"));
  for (const label of labels) {
    if (normalizeText(label.textContent || "") !== normalizedLabel) {
      continue;
    }

    const forId = label.getAttribute("for");
    if (forId) {
      const byId = document.getElementById(forId);
      if (byId && (byId instanceof HTMLInputElement || byId instanceof HTMLSelectElement || byId instanceof HTMLTextAreaElement)) {
        return byId;
      }
    }

    const nested = label.querySelector("input,select,textarea");
    if (nested && (nested instanceof HTMLInputElement || nested instanceof HTMLSelectElement || nested instanceof HTMLTextAreaElement)) {
      return nested;
    }
  }

  return null;
}

function findByAttribute(attribute: "name" | "aria-label" | "placeholder", value?: string): FillableElement | null {
  if (!value) {
    return null;
  }

  const candidates = document.querySelectorAll<FillableElement>(`input[${attribute}], select[${attribute}], textarea[${attribute}]`);
  return Array.from(candidates).find((element) => element.getAttribute(attribute) === value) ?? null;
}

function findElement(mapping: FieldMapping): FillableElement | null {
  const candidates: Array<() => FillableElement | null> = [
    () => {
      if (!mapping.fieldId) {
        return null;
      }
      const node = document.getElementById(mapping.fieldId);
      if (node && (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)) {
        return node;
      }
      return null;
    },
    () => {
      if (!mapping.selector) {
        return null;
      }
      try {
        const node = document.querySelector(mapping.selector);
        if (node && (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)) {
          return node;
        }
      } catch {
        return null;
      }
      return null;
    },
    () => {
      return findByAttribute("name", mapping.fieldName);
    },
    () => {
      return findByAttribute("aria-label", mapping.fieldAriaLabel);
    },
    () => {
      return findByAttribute("placeholder", mapping.fieldPlaceholder);
    },
    () => findByLabel(mapping.fieldLabel),
  ];

  for (const candidate of candidates) {
    const result = candidate();
    if (result) {
      return result;
    }
  }

  return null;
}

function createSnapshotItem(element: FillableElement): FillSnapshotItem {
  const input = element as HTMLInputElement;
  const item: FillSnapshotItem = {
    selector: getElementSelector(element),
    fieldType: input.type || element.tagName.toLowerCase(),
  };

  if (element instanceof HTMLInputElement && (input.type === "checkbox" || input.type === "radio")) {
    item.previousChecked = input.checked;
  } else {
    item.previousValue = element.value;
  }

  return item;
}

export function setNativeValue(element: FillableElement, value: string): void {
  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (setter) {
    setter.call(element, value);
    return;
  }

  element.value = value;
}

function fillElement(element: FillableElement, value: string): boolean {
  const tagName = element.tagName.toLowerCase();
  const type = (element as HTMLInputElement).type?.toLowerCase() || "";

  if (tagName === "input" && type === "radio") {
    const radioElement = element as HTMLInputElement;
    const shouldCheck = normalizeText(radioElement.value) === normalizeText(value) || ["true", "1", "yes", "on", "checked"].includes(normalizeText(value));
    if (!shouldCheck) {
      return false;
    }
    if (!radioElement.checked) {
      radioElement.click();
    }
    return true;
  }

  if (tagName === "input" && type === "checkbox") {
    const checkboxElement = element as HTMLInputElement;
    const shouldCheck = ["true", "1", "yes", "on", "checked"].includes(value.toLowerCase());
    if (checkboxElement.checked !== shouldCheck) {
      checkboxElement.click();
    }
    return true;
  }

  if (tagName === "select") {
    const selectElement = element as HTMLSelectElement;
    let optionFound = false;

    for (const option of selectElement.options) {
      if (normalizeText(option.value) === normalizeText(value) || normalizeText(option.textContent || "") === normalizeText(value)) {
        setNativeValue(selectElement, option.value);
        optionFound = true;
        break;
      }
    }

    if (!optionFound) {
      for (const option of selectElement.options) {
        if (normalizeText(option.textContent || "").includes(normalizeText(value))) {
          setNativeValue(selectElement, option.value);
          optionFound = true;
          break;
        }
      }
    }

    if (!optionFound) {
      return false;
    }

    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  if (tagName === "input" && ["button", "file", "hidden", "image", "reset", "submit"].includes(type)) {
    return false;
  }

  setNativeValue(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function highlightElement(element: FillableElement): void {
  const previousOutline = element.style.outline;
  const previousOutlineOffset = element.style.outlineOffset;
  element.style.outline = "2px solid #16a34a";
  element.style.outlineOffset = "2px";

  setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOutlineOffset;
  }, 1500);
}

export function applyFieldMappings(mappings: FieldMapping[]): { success: boolean; filledCount: number; errors: string[]; snapshot: FillSnapshot } {
  const snapshot: FillSnapshot = {
    url: window.location.href,
    createdAt: Date.now(),
    items: [],
  };

  const errors: string[] = [];
  let filledCount = 0;

  for (const mapping of mappings) {
    if (!mapping.enabled || mapping.status === "unmatched") {
      continue;
    }

    const element = findElement(mapping);
    if (!element) {
      errors.push(`Unable to locate field for key: ${mapping.responseKey}`);
      continue;
    }

    snapshot.items.push(createSnapshotItem(element));

    let filled: boolean;
    try {
      filled = fillElement(element, mapping.responseValue);
    } catch {
      errors.push(`Unable to apply value for key: ${mapping.responseKey}`);
      continue;
    }
    if (!filled) {
      errors.push(`Unable to apply value for key: ${mapping.responseKey}`);
      continue;
    }

    highlightElement(element);
    filledCount += 1;
  }

  return {
    success: errors.length === 0,
    filledCount,
    errors,
    snapshot,
  };
}

function queryFillable(selector: string): FillableElement | null {
  try {
    const node = document.querySelector(selector);
    if (node && (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement)) {
      return node;
    }
  } catch {
    return null;
  }
  return null;
}

export function undoFillSnapshot(snapshot?: FillSnapshot): { success: boolean; restoredCount: number; errors: string[] } {
  if (!snapshot || snapshot.items.length === 0) {
    return {
      success: false,
      restoredCount: 0,
      errors: ["No fill snapshot available"],
    };
  }

  let restoredCount = 0;
  const errors: string[] = [];

  snapshot.items.forEach((item) => {
    const element = queryFillable(item.selector);
    if (!element) {
      errors.push(`Unable to locate field for selector: ${item.selector}`);
      return;
    }

    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      if (item.previousChecked !== undefined) {
        element.checked = item.previousChecked;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        restoredCount += 1;
      }
      return;
    }

    setNativeValue(element, item.previousValue || "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    restoredCount += 1;
  });

  return {
    success: errors.length === 0,
    restoredCount,
    errors,
  };
}
