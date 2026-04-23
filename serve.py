#!/usr/bin/env python3
import http.server
import socketserver

PORT = 5000

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

with ReusableTCPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
    print(f"Serving HTTP on 0.0.0.0 port {PORT} (http://0.0.0.0:{PORT}/) ...", flush=True)
    httpd.serve_forever()
