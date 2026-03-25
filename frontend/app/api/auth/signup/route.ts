export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";

    const response = await fetch(`${backendUrl}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return Response.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
