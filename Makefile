# Agora — common Make targets (guestkit-style H= / U=)

H ?=
U ?= sus
PORT ?=
ARGS ?=

.PHONY: help deploy-remote deploy-remote-uninstall

help:
	@echo "Agora"
	@echo "  make deploy-remote H=<host> U=sus [PORT=30591]"
	@echo "  make deploy-remote-uninstall H=<host> U=sus"
	@echo "  ./scripts/deploy-remote.sh --help"

deploy-remote:
	@test -n "$(H)" || { echo "H=<host> required (e.g. make deploy-remote H=zoreon.example.com U=sus)"; exit 1; }
	bash scripts/deploy-remote.sh --host "$(H)" --user "$(U)" $(if $(PORT),--port $(PORT),) $(ARGS)

deploy-remote-uninstall:
	@test -n "$(H)" || { echo "H=<host> required"; exit 1; }
	bash scripts/deploy-remote.sh --host "$(H)" --user "$(U)" --uninstall $(ARGS)
