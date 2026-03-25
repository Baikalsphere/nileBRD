export async function GET(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";

    const response = await fetch(`${backendUrl}/api/admin/users`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(data, { status: response.status });
    }

    return Response.json(data, { status: 200 });
  } catch (error) {
    console.error("Get users error:", error);
    return Response.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
