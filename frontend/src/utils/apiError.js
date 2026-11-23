import i18n from "../i18n";

const HTTP_STATUS_KEY_MAP = {
  400: "error.http.400",
  401: "error.http.401",
  403: "error.http.403",
  404: "error.http.404",
  409: "error.http.409",
  422: "error.http.422",
  429: "error.http.429",
  500: "error.http.500",
  502: "error.http.502",
  503: "error.http.503",
};

/**
 * Map an Axios/API error to a localized user-facing message.
 * Prioritizes stable backend error codes, then HTTP status codes, then fallback.
 * Never exposes stack traces or sensitive technical details.
 */
export function getApiErrorMessage(error, tFn, fallbackKey = "error.unknown") {
  const translate = typeof tFn === "function" ? tFn : i18n.t.bind(i18n);

  if (!error) {
    return translate(fallbackKey);
  }

  if (error.code === "ECONNABORTED") {
    return translate("error.timeout");
  }

  if (!error.response) {
    return translate("error.network");
  }

  const data = error.response.data || {};
  const errorCode = data.code || data.errorCode || data.error?.code;

  if (typeof errorCode === "string" && errorCode.trim()) {
    const codeKey = `error.codes.${errorCode.trim()}`;
    if (i18n.exists(codeKey)) {
      return translate(codeKey);
    }
  }

  const status = error.response.status;
  if (status && HTTP_STATUS_KEY_MAP[status]) {
    return translate(HTTP_STATUS_KEY_MAP[status]);
  }

  return translate(fallbackKey);
}

export default getApiErrorMessage;
