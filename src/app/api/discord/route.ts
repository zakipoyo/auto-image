import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "DISCORD_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Build Discord webhook payload
    const discordForm = new FormData();
    discordForm.append("file", file, file.name);
    if (content) {
      discordForm.append("payload_json", JSON.stringify({ content }));
    }

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      body: discordForm,
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord webhook error:", errText);
      return NextResponse.json(
        { error: `Discord API error: ${discordRes.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Discord send error:", err);
    return NextResponse.json(
      { error: "Failed to send to Discord" },
      { status: 500 }
    );
  }
}
