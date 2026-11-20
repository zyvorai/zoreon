# Zoreon — common Make targets (H= / U=)

H ?=
U ?=
PORT ?=
ARGS ?=

.PHONY: help deploy-remote deploy-remote-uninstall

help:
	@echo "Zoreon"
	@echo "  make deploy-remote H=<host> U=<user> [PORT=30591]"
	@echo "  make deploy-remote-uninstall H=<host> U=<user>"
	@echo "  ./scripts/deploy-remote.sh --help"

deploy-remote:
	@test -n "$(H)" || { echo "H=<host> required (e.g. make deploy-remote H=zoreon.example.com U=deploy)"; exit 1; }
	@test -n "$(U)" || { echo "U=<user> required"; exit 1; }
	bash scripts/deploy-remote.sh --host "$(H)" --user "$(U)" $(if $(PORT),--port $(PORT),) $(ARGS)

deploy-remote-uninstall:
	@test -n "$(H)" || { echo "H=<host> required"; exit 1; }
	@test -n "$(U)" || { echo "U=<user> required"; exit 1; }
	bash scripts/deploy-remote.sh --host "$(H)" --user "$(U)" --uninstall $(ARGS)
