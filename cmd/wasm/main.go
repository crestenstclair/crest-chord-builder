//go:build js && wasm

package main

import (
	"encoding/json"
	"github.com/crestenstclair/crest-chord-builder/engine"
	"syscall/js"
)

func main() {
	generate := js.FuncOf(func(this js.Value, args []js.Value) any {
		var request engine.Request
		if len(args) != 1 {
			return `{"error":"expected one request"}`
		}
		err := json.Unmarshal([]byte(args[0].String()), &request)
		var result []engine.Voicing
		if err == nil {
			result, err = engine.Generate(request)
		}
		if err != nil {
			data, _ := json.Marshal(map[string]string{"error": err.Error()})
			return string(data)
		}
		data, _ := json.Marshal(map[string]any{"voicings": result})
		return string(data)
	})
	js.Global().Set("crestGenerate", generate)
	select {}
}
