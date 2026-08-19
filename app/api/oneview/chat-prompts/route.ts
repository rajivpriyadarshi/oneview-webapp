import { NextResponse } from "next/server";

const CHAT_PROMPTS = [
  {
    id: 1,
    title: "Portfolio review",
    description: "Review current portfolio allocation and performance",
    user_message:
      "Give me a comprehensive review of my current portfolio — allocation breakdown, recent performance, and any areas that need attention.",
  },
  {
    id: 2,
    title: "Meeting prep",
    description: "Prepare talking points for an upcoming client meeting",
    user_message:
      "Help me prepare for my upcoming client meeting. Summarize key portfolio changes, performance highlights, and any action items to discuss.",
  },
  {
    id: 3,
    title: "Opportunity finder",
    description: "Identify investment opportunities based on current market conditions",
    user_message:
      "Based on current market conditions and my portfolio, what investment opportunities should I be considering? Highlight any sectors or assets that look promising.",
  },
];

export async function GET() {
  return NextResponse.json({ prompts: CHAT_PROMPTS });
}
