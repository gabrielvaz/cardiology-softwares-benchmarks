PORT ?= 8080

.PHONY: serve start stop open status

serve:
	python3 -m http.server $(PORT)

start:
	nohup python3 -m http.server $(PORT) > .http.log 2>&1 & echo $$! > .http.pid; \
		echo "Started on http://localhost:$(PORT) (PID $$(cat .http.pid))"

stop:
	@if [ -f .http.pid ]; then \
		pid=$$(cat .http.pid); \
		kill $$pid && rm -f .http.pid && echo "Stopped PID $$pid"; \
	else \
		echo "No server PID file (.http.pid)"; \
	fi

open:
	open -a "Google Chrome" "http://localhost:$(PORT)/index.html"

status:
	@echo "Checking port $(PORT)"; \
	(lsof -i :$(PORT) -sTCP:LISTEN || true)

