import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { OfficialCoordination } from "../OfficialCoordination";
import { getOfficialCoordination, sendOfficialCoordination, type OfficialCoordination as Coordination } from "../api";

vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ sessionId: "session-a" }) }));
vi.mock("../api", () => ({ getOfficialCoordination: vi.fn(), sendOfficialCoordination: vi.fn() }));

const thread = (readOnly = false): Coordination => ({ eventId: 12, status: readOnly ? "CANCELLED" : "SCHEDULED", readOnly, participants: [{ userId: 4, fullName: "Host coach", role: "STAFF" }], messages: [], page: 0, size: 30, totalElements: 0, totalPages: 0, hasMore: false });
beforeEach(() => { vi.mocked(getOfficialCoordination).mockResolvedValue(thread()); vi.mocked(sendOfficialCoordination).mockResolvedValue({ id: 3, authorId: 4, authorName: "Host coach", body: "Bring bibs", createdAt: "2026-09-01T10:00:00Z" }); });

it("retains a cancelled thread for staff as read-only", async () => {
  vi.mocked(getOfficialCoordination).mockResolvedValue(thread(true));
  render(<OfficialCoordination eventId={12}/>);
  expect(await screen.findByText(/discussion is retained/i)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("blocks a double submit while preserving one idempotency request id for retry", async () => {
  let resolve!: (value: { id: number; authorId: number; authorName: string; body: string; createdAt: string }) => void;
  vi.mocked(sendOfficialCoordination).mockReturnValueOnce(new Promise(value => { resolve = value; }));
  render(<OfficialCoordination eventId={12}/>);
  const box = await screen.findByRole("textbox", { name: "Message to the match officials" });
  fireEvent.change(box, { target: { value: "Bring bibs" } });
  const button = screen.getByRole("button", { name: "Send message" }); fireEvent.click(button); fireEvent.click(button);
  expect(sendOfficialCoordination).toHaveBeenCalledTimes(1);
  const requestId = vi.mocked(sendOfficialCoordination).mock.calls[0][2];
  resolve({ id: 3, authorId: 4, authorName: "Host coach", body: "Bring bibs", createdAt: "2026-09-01T10:00:00Z" });
  await waitFor(() => expect(screen.getByText("Bring bibs")).toBeInTheDocument());
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
});
