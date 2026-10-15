// Word pools come from each unit's Vocabulary stages (B1L1–B1L24) plus the
// everyday nouns those lessons talk about. Every game draws a fresh board from
// the pool.

export type BoardKey = "u1" | "u2" | "u3" | "u4" | "all";

export type Board = {
  name: string;
  cols: string[];
  rows: string[];
};

export const BOARDS: Record<BoardKey, Board> = {
  u1: {
    name: "Unit One · Who I am",
    cols: ["Coffee", "Email", "Meeting", "Office", "Car", "Team", "Phone", "Deadline", "Breakfast", "Computer"],
    rows: ["Morning", "Night", "Monday", "Work", "Home", "Weekend", "Family", "Late", "Hospital", "School"],
  },
  u2: {
    name: "Unit Two · You and me",
    cols: ["Pizza", "Coffee", "Elevator", "Restaurant", "Pharmacy", "Series", "Gym", "Book", "Bill", "Supermarket"],
    rows: ["Friends", "Expensive", "Sweet", "Fast", "Cold", "Reception", "Music", "Night", "Card", "Hungry"],
  },
  u3: {
    name: "Unit Three · What happened",
    cols: ["Problem", "Presentation", "Report", "Delay", "Mistake", "Bug", "Appointment", "Errand", "Update", "Deadline"],
    rows: ["Traffic", "Doctor", "Bank", "Manager", "Computer", "Phone", "Rain", "Coffee", "Monday", "Client"],
  },
  u4: {
    name: "Unit Four · What's next",
    cols: ["Tomorrow", "Friday", "Weekend", "Holiday", "Invite", "Calendar", "Noon", "Party", "Dinner", "Trip"],
    rows: ["Cancel", "Confirm", "Postpone", "Free", "Busy", "Plan", "Family", "Office", "Late", "Birthday"],
  },
  all: {
    name: "All units (mixed)",
    cols: [],
    rows: [],
  },
};

export const BOARD_KEYS = Object.keys(BOARDS) as BoardKey[];
