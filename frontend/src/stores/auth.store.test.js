import useAuthStore from "./auth.store";

describe("auth.store reactive isAuthenticated & session initialization", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: false,
    });
  });

  test("initial state is unauthenticated and uninitialized in memory", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.initialized).toBe(false);
  });

  test("setAuth updates token, user, isAuthenticated, and initialized in memory (no localStorage)", () => {
    const mockUser = { adminId: 1, username: "admin", fullName: "Admin User" };
    const mockToken = "mock_jwt_token_123";

    useAuthStore.getState().setAuth(mockUser, mockToken);

    const state = useAuthStore.getState();
    expect(state.token).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.initialized).toBe(true);
    expect(localStorage.getItem("vietinsect_token")).toBeNull();
  });

  test("setToken updates token and optionally user on silent refresh", () => {
    const mockUser = { adminId: 1, username: "admin", fullName: "Admin User" };
    useAuthStore.getState().setToken("refreshed_token_456", mockUser);

    const state = useAuthStore.getState();
    expect(state.token).toBe("refreshed_token_456");
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.initialized).toBe(true);
  });

  test("logout clears token and user while keeping initialized true", () => {
    const mockUser = { adminId: 1, username: "admin" };
    useAuthStore.getState().setAuth(mockUser, "mock_jwt_token_123");

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.initialized).toBe(true);
  });
});
