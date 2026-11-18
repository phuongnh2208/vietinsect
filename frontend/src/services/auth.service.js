import http from "./http";

async function login(username, password) {
  const { data } = await http.post("/auth/login", { username, password });
  return data.data; // { accessToken, user: { adminId, username, fullName } }
}

async function logout() {
  // Gọi POST /api/auth/logout để server revoke refresh token trong cookie
  await http.post("/auth/logout");
}

const authService = { login, logout };

export default authService;
