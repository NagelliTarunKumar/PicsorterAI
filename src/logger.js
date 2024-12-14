const logToBackend = async (level, message, meta = {}) => {
    try {
      await fetch("http://127.0.0.1:3001/capture-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ level, message, meta }),
      });
    } catch (error) {
      console.error("[Frontend] Error sending log to backend:", error);
    }
  };
  
  const logger = {
    info: (message, meta) => logToBackend("info", message, meta),
    warn: (message, meta) => logToBackend("warn", message, meta),
    error: (message, meta) => logToBackend("error", message, meta),
    debug: (message, meta) => logToBackend("debug", message, meta),
  };
  
  export default logger;
  