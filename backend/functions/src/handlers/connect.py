from functions.src.utils.http_response import http_response


def handler(event, context):
    return http_response(200, {"success": True})
