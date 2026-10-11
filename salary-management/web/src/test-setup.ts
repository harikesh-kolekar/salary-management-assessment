import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach } from "vitest";

beforeEach(() => localStorage.setItem("acme-salary-session-token", "test-session-token"));
afterEach(() => localStorage.clear());
