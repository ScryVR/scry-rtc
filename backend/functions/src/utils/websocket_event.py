import json

def websocket_event(type, data):
  return json.dumps({ "type": type, "data": data }).encode()