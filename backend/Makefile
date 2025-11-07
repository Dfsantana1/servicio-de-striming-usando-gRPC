PROTO_SRC=proto/metrics.proto
PROTO_OUT=app
PYTHON=python

.PHONY: gen-proto run test lint

gen-proto:
	$(PYTHON) -m grpc_tools.protoc -I proto --python_out=$(PROTO_OUT) --grpc_python_out=$(PROTO_OUT) $(PROTO_SRC)

run: gen-proto
	$(PYTHON) -m app.server

lint:
	ruff check app tests

fix:
	ruff check --fix app tests

test: gen-proto
	pytest -q tests

