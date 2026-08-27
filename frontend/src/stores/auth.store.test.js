import useAuthStore from "./auth.store";

describe("auth.store reactive isAuthenticated", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  test("initial state is unauthenticated when no token in localStorage", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  test("setAuth updates token, user, and isAuthenticated reactively without page reload", () => {
    const mockUser = { adminId: 1, username: "admin", fullName: "Admin User" };
    const mockToken = "mock_jwt_token_123";

    useAuthStore.getState().setAuth(mockUser, mockToken);

    const state = useAuthStore.getState();
    expect(state.token).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(localStorage.getItem("vietinsect_token")).toBe(mockToken);
  });

  test("logout clears token, user, and sets isAuthenticated to false", () => {
    const mockUser = { adminId: 1, username: "admin" };
    const mockToken = "mock_jwt_token_123";

    useAuthStore.getState().setAuth(mockUser, mockToken);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem("vietinsect_token")).toBeNull();
  });
});
