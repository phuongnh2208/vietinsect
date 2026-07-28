import http from "./http";

async function login(username, password) {
  const { data } = await http.post("/auth/login", { username, password });
  return data.data; // { token, user: { adminId, username, fullName } }
}

export default { login };
