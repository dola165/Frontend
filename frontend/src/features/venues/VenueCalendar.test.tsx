import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { VenueCalendar } from "./VenueCalendar";
import {
  createBooking,
  fetchAvailability,
  type Availability,
  type Venue,
} from "./api";
import { bookingDuration, validDate, zonedInstant } from "./utils";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("./api", async () => ({
  ...(await vi.importActual("./api")),
  createBooking: vi.fn(),
  fetchAvailability: vi.fn(),
}));

const venue: Venue = {
  id: 22,
  revision: 1,
  displayName: "Test Stadium",
  description: "",
  city: "Tbilisi",
  addressText: "Test address",
  latitude: 41,
  longitude: 44,
  timezone: "Asia/Tbilisi",
  currency: "GEL",
  publicPhone: "+995555123456",
  publicEmail: "",
  website: "",
  bookingMode: "REQUEST",
  published: true,
  cancellationHours: 24,
  minBookingMinutes: 60,
  maxBookingMinutes: 180,
  slotMinutes: 30,
  amenities: [],
  photos: [],
  openingHours: [],
  canManage: false,
  verificationStatus: "UNVERIFIED",
  pitches: [
    {
      id: 9,
      revision: 0,
      name: "Main pitch",
      format: "5_A_SIDE",
      surface: "ARTIFICIAL_GRASS",
      covered: false,
      pricePerHour: 80,
      active: true,
      resourceGroup: "",
      resourceUnits: [],
    },
  ],
};
const availability: Availability = {
  venueId: 22,
  timezone: "Asia/Tbilisi",
  fromDate: "2099-10-01",
  toDate: "2099-10-07",
  days: [
    {
      date: "2099-10-01",
      pitches: [
        {
          pitchId: 9,
          slots: [
            {
              startsAt: "2099-10-01T18:00:00+04:00",
              endsAt: "2099-10-01T19:00:00+04:00",
              available: true,
              price: 80,
            },
            {
              startsAt: "2099-10-01T19:00:00+04:00",
              endsAt: "2099-10-01T20:00:00+04:00",
              available: false,
              price: 80,
            },
          ],
          blocks: [],
        },
      ],
    },
  ],
};
const setup = (search = "?date=2099-10-01") =>
  render(
    <MemoryRouter initialEntries={[`/stadiums/22${search}`]}>
      <VenueCalendar venue={venue} />
    </MemoryRouter>,
  );
const chooseTime = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Start 18:00" }));
  fireEvent.click(screen.getByRole("button", { name: "End 19:00" }));
  await waitFor(() => expect(screen.getByRole("button", {name:"Continue"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button", {name:"Continue"}));
};
const fillContact = () => {
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "+995555000111" },
  });
  const policy = screen.getByRole("checkbox") as HTMLInputElement;
  if (!policy.checked) fireEvent.click(policy);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: true,
    user: { id: 7, fullName: "Test Player" },
    sessionId: "session-one",
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(fetchAvailability).mockResolvedValue(availability);
  vi.mocked(createBooking).mockResolvedValue([
    { status: "PENDING" } as Awaited<ReturnType<typeof createBooking>>[number],
  ]);
});

it("submits the server quote and weekly selection, while unavailable slots stay disabled", async () => {
  setup();
  await chooseTime();
  fillContact();

  fireEvent.change(screen.getByLabelText("Make it a regular game"), {
    target: { value: "3" },
  });
  expect(screen.getByText(/3 weekly reservations/)).toHaveTextContent("240");
  fireEvent.click(screen.getByRole("button", { name: "Request this time" }));
  await waitFor(() =>
    expect(createBooking).toHaveBeenCalledWith(
      22,
      expect.objectContaining({
        pitchId: 9,
        expectedTotalPrice: 80,
        currency: "GEL",
        repeatWeeks: 3,
        contactName: "Test Player",
        requestId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      }),
    ),
  );
  expect(
    await screen.findByText(/Awaiting owner confirmation/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Pay directly at the venue/)).toBeInTheDocument();
});

it("preserves a booking conflict message after refreshing availability", async () => {
  vi.mocked(createBooking).mockRejectedValue({
    response: {
      status: 409,
      data: { error: "This pitch has just been reserved." },
    },
  });
  setup();
  await chooseTime();
  fillContact();
  fireEvent.click(screen.getByRole("button", { name: "Request this time" }));
  await waitFor(() => expect(fetchAvailability).toHaveBeenCalledTimes(3));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This pitch has just been reserved.",
  );
  expect(await screen.findByRole("button", { name: "Start 18:00" })).toBeEnabled();
});

it("changes the idempotency key when the submitted contact changes after failure", async () => {
  vi.mocked(createBooking).mockRejectedValueOnce(new Error("Offline"));
  setup();
  await chooseTime();
  fillContact();
  fireEvent.click(screen.getByRole("button", { name: "Request this time" }));
  await waitFor(() => expect(fetchAvailability).toHaveBeenCalledTimes(3));
  await chooseTime();
  fillContact();
  fireEvent.change(screen.getByLabelText("Contact name"), {
    target: { value: "Updated contact" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Request this time" }));
  await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(createBooking).mock.calls;
  expect(calls[0][1].requestId).not.toBe(calls[1][1].requestId);
});

it("retains the stadium date and duration through sign-in", async () => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    user: null,
    sessionId: "anonymous",
  } as unknown as ReturnType<typeof useAuth>);
  setup();
  await chooseTime();
  const href = screen
    .getByRole("link", { name: "Sign in to reserve" })
    .getAttribute("href");
  expect(decodeURIComponent(href!)).toContain(
    "/stadiums/22?book=1&date=2099-10-01&duration=60",
  );
});

it("rejects malformed dates and aligns durations to the venue interval", async () => {
  setup("?date=2099-99-99&duration=61");
  await waitFor(() => expect(fetchAvailability).toHaveBeenCalled());
  const args = vi.mocked(fetchAvailability).mock.calls[0];
  expect(validDate(args[1])).toBe(true);
  expect(args[2]).toBe(60);
});

it("interprets owner times in the venue timezone, including seasonal offsets", () => {
  expect(zonedInstant("2026-09-17", "18:00", "Asia/Tbilisi")).toBe(
    "2026-09-17T14:00:00.000Z",
  );
  expect(zonedInstant("2026-07-01", "18:00", "Europe/London")).toBe(
    "2026-07-01T17:00:00.000Z",
  );
  expect(zonedInstant("2026-01-01", "18:00", "Europe/London")).toBe(
    "2026-01-01T18:00:00.000Z",
  );
  expect(() => zonedInstant("2026-03-29", "01:30", "Europe/London")).toThrow(
    "does not exist",
  );
  expect(validDate("2026-02-30")).toBe(false);
  expect(validDate("2028-02-29")).toBe(true);
  expect(bookingDuration(89, 60, 180, 30)).toBe(60);
});


it("keeps details out of the time step and retains contact and repeat choices when editing", async () => {
  setup();
  expect(screen.queryByRole("textbox", {name:"Phone number"})).not.toBeInTheDocument();
  await chooseTime();
  fillContact();
  fireEvent.change(screen.getByLabelText("Make it a regular game"), {target:{value:"4"}});
  fireEvent.click(screen.getByRole("button", {name:"Edit day & time"}));
  expect(screen.queryByRole("textbox", {name:"Phone number"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"Continue"}));
  expect(screen.getByLabelText("Phone number")).toHaveValue("+995555000111");
  expect(screen.getByLabelText("Make it a regular game")).toHaveValue("4");
});

it("allows an occupied start boundary as an end, but cannot cross the occupied interval", async () => {
  setup();
  expect(await screen.findByRole("button",{name:"Start 19:00, unavailable"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Start 18:00"}));
  expect(screen.getByRole("button",{name:"End 19:00"})).toBeEnabled();
  expect(screen.getByRole("button",{name:"End 20:00, unavailable"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();
});

it("rejects a range that becomes occupied during the exact quote check", async () => {
  vi.mocked(fetchAvailability).mockResolvedValueOnce(availability).mockResolvedValueOnce({...availability, days:[]});
  setup();
  fireEvent.click(await screen.findByRole("button",{name:"Start 18:00"}));
  fireEvent.click(screen.getByRole("button",{name:"End 19:00"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
  expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();
  expect(createBooking).not.toHaveBeenCalled();
});

it("ignores a late quote after the day changes", async () => {
  let resolve!: (value: Availability) => void;
  vi.mocked(fetchAvailability).mockResolvedValueOnce(availability).mockImplementationOnce(() => new Promise(done => {resolve=done;}));
  setup();
  fireEvent.click(await screen.findByRole("button",{name:"Start 18:00"}));
  fireEvent.click(screen.getByRole("button",{name:"End 19:00"}));
  await waitFor(() => expect(fetchAvailability).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button",{name:"Next week"}));
  resolve(availability);
  await waitFor(() => expect(fetchAvailability).toHaveBeenCalledTimes(3));
  expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();
});

it("books the selected 2.5-hour range with the exact server price on every repeated date", async () => {
  vi.mocked(fetchAvailability).mockImplementation(async (_id, date, minutes) => ({
    ...availability,
    days: [{ date, pitches: [{pitchId:9, blocks:[], slots:Array.from({length:8},(_,i) => ({
      startsAt:new Date(Date.parse(`${date}T18:00:00+04:00`)+i*30*60000).toISOString(),
      endsAt:new Date(Date.parse(`${date}T18:00:00+04:00`)+(i*30+minutes)*60000).toISOString(),
      available:true, price:minutes === 150 ? 207.5 : 80,
    }))}] }],
  }));
  setup();
  fireEvent.click(await screen.findByRole("button",{name:"Start 18:00"}));
  fireEvent.click(screen.getByRole("button",{name:"End 20:30"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Continue"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Continue"}));
  fillContact();
  fireEvent.change(screen.getByLabelText("Make it a regular game"),{target:{value:"3"}});
  fireEvent.click(screen.getByRole("button",{name:"Request this time"}));
  await waitFor(() => expect(createBooking).toHaveBeenCalledWith(22,expect.objectContaining({
    startsAt:"2099-10-01T14:00:00.000Z",endsAt:"2099-10-01T16:30:00.000Z",expectedTotalPrice:207.5,repeatWeeks:3,
  })));
});

it("restores a valid time range after sign-in and rechecks its price", async () => {
  setup("?book=1&date=2099-10-01&pitch=9&start=2099-10-01T14:00:00.000Z&end=2099-10-01T15:00:00.000Z");
  await waitFor(() => expect(screen.getByRole("button",{name:"Continue"})).toBeEnabled());
  expect(fetchAvailability).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button",{name:"End 19:00"})).toHaveAttribute("aria-pressed","true");
});
