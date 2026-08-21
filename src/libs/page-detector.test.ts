import { describe, expect, it } from "vitest";
import { isHostOrSubdomain } from "./clipboard";

describe("isHostOrSubdomain", () => {
  it.each([
    ["chatgpt.com", "chatgpt.com"],
    ["www.chatgpt.com", "chatgpt.com"],
    ["chat.openai.com", "chat.openai.com"],
    ["chat.deepseek.com", "deepseek.com"],
    ["DEEPSEEK.COM.", "deepseek.com"],
  ])("accepts trusted host %s", (hostname, allowedDomain) => {
    expect(isHostOrSubdomain(hostname, allowedDomain)).toBe(true);
  });

  it.each([
    ["evilchatgpt.com", "chatgpt.com"],
    ["chatgpt.com.attacker.example", "chatgpt.com"],
    ["notchat.openai.com", "chat.openai.com"],
    ["deepseek.com.attacker.example", "deepseek.com"],
    ["deepseek.com.evil.example", "deepseek.com"],
  ])("rejects untrusted host %s", (hostname, allowedDomain) => {
    expect(isHostOrSubdomain(hostname, allowedDomain)).toBe(false);
  });
});
