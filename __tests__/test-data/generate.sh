cd ./__tests__/test-data
protoc --plugin=protoc-gen-grpc-web=../../node_modules/.bin/protoc-gen-grpc-web --js_out="import_style=commonjs,binary:./generated" --grpc-web_out="import_style=typescript,mode=grpcweb:./generated" ./book-store.proto
