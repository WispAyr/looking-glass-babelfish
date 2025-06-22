aprs.fi Application Programming Interface · aprs.fi – live APRS map · map view
API plugs
The aprs.fi API (Application Programming Interface) allows application developers to query the aprs.fi database from their own web applications. To use the API you need to sign up for an user account on aprs.fi - your API key can be found in the account settings (My account).

Terms:

You are required to credit aprs.fi as the source of the data, and to provide a link back to aprs.fi. Links with text color equal to the background color do not count.
The API may only be used by applications which are free to use and available to the general public. If you wish to use the API for a paid-for application, please contact me and give a suggestion on a revenue sharing model.
It's OK to have advertisements on your site (like aprs.fi does) to cover the costs of hosting, hardware, etc.
If your application requires registration, it must be free and automated.
If you are going to distribute your application to others, please have each user apply for their own API key. Requests are rate limited per user account / API key, and having everyone use the same key will hit the limits faster. If your application requires using a constant API key (for example, the application is targeted to the masses and is distributed in binary form, and must be easy to install), please get in touch with me and describe your requirements, so that the rate limits can be tuned for the application.
If you're going to distribute your application, please get in touch, in any case. It's nice to hear how the API is used, and I'm happy to give feedback and advice on how to best use it. My email address can be found in the blogger profile, or you can send a mail on the discussion group.
Your application must identify it's unique name, version, and a link to it's home page in the HTTP User-Agent header of the request. For example, here's what one application sends:
User-Agent: findlinks/1.1.6-beta1 (+http://wortschatz.uni-leipzig.de/findlinks/)
The application may only request data when it is actively needed by the end-user. Do not preload, pre-cache, or collect data using the API for archival purposes. Most private web sites only get a request once per few hours, so they should not update their data automatically every minute on the background, as it will only increase the load unnecessarily.
The previous clause does not prohibit caching. Caching is good. When an user requests data from your service, fetch it from aprs.fi, and cache it for some time so that you can reuse it in case some other user needs the same data.
The service may or may not be available at any time. The availability is generally very good, but as always, there are no guarantees. If it breaks, you get to keep both pieces.
The API may be shut down at any time without notice, or your account may be cancelled with or without reason. I'll try to warn you on the blog and discussion group if that should happen.
Please behave nicely - if this service is abused, it might just go away. Thank you!
Have fun!
The API is supposed to be used for developing applications which add value to the data collected by aprs.fi. It may not be used to simply copy all of the data to another site providing exactly the same features as aprs.fi. If you wish to set up a clone site, please collect your data directly from the APRS-IS - it's easy to parse using Ham::APRS::FAP.

The API limits the rate of requests to a sensible level, which can be adjusted if needed. The limits are designed to protect aprs.fi from too heavy load, and to protect the database contents from harvesting. If your application hits the limits and you'd like to have a larger quota, please get in touch and describe your application's needs in detail.

Most requests should normally be served within tens of milliseconds, since they do not usually require any disk access. In any case, you should write your application so that it will time out requests in a few seconds. If multiple requests fail in a row, your application should assume that the service is not available and slow down the rate of attempts using an exponential backoff algorithm.

The API returns data in either JSON or XML format, JSON being the default and recommended format since it has much smaller overhead when compared to XML. XML responses can be easily twice as large as the equivalent JSON responses. See json.org for parsing instructions. If you're programming in PHP, json_decode is your friend.

This document lists all the API calls available. If a function is not listed here, it is not there; unfortunately there are not hidden gems to be found.

2017-03-09 – News!

The API URLs have been updated. They all point to https://api.aprs.fi/api/ now, instead of http://api.aprs.fi/api/. Please upgrade your applications. The old plaintext URLs will still work for the foreseeable future, but using https will keep your API keys safe. Thank you!

2010-09-09 – News!

The API URLs have been updated. They all point to http://api.aprs.fi/api/ now, instead of http://aprs.fi/api/. Please upgrade your applications. The old URLs pointing to aprs.fi will stop working in December 2010. This change has been made to make it possible to move the API code to another server or process set, if necessary. Thank you!

Basic location query using JSON:

Whitespace and indentation has been added to the response to increase readability in this document.

Timestamps are returned in the Unix time format. All other variables are returned in metric units, where applicable. Speed is measured in kilometers per hour, altitude in meters, temperature in degrees Celsius. Latitude and Longitude are given in decimal degrees, positive values being north for latitude and east for longitude. The responses only contain keys for data which is known.

Please note that this API is for querying specific stations. It intentionally does not support searching by wildcard.

https://api.aprs.fi/api/get?name=OH7RDA&what=loc&apikey=APIKEY&format=json

{
	"command":"get",
	"result":"ok",
	"what":"loc",
	"found":1,
	"entries": [
		{
			"name":"OH7RDA",
			"type":"l",
			"time":"1267445689",
			"lasttime":"1270580127",
			"lat":"63.06717",
			"lng":"27.66050",
			"symbol":"\/#",
			"srccall":"OH7RDA",
			"dstcall":"APND12",
			"phg":"44603",
			"comment":"\/R,W,Wn,Tn Siilinjarvi",
			"path":"WIDE2-2,qAR,OH7AA"
		}
	]
}
Description of common fields:

command - the API command which was called
what - what was being queried
result - the result of the query, either ok or fail
found - the number of entries returned
Description of location record fields:

class - class of station identifier (a: APRS, i: AIS, w: Web ...)
name - name of station, object, item or vessel
showname - displayed name of station (may differ from the unique name)
type - type of target: a for AIS, l for APRS station, i for APRS item, o for APRS object, w for weather station
time - the time when the target first reported this (current) position (the time of arrival at current coordinates)
lasttime - the time when the target last reported this (current) position
lat - latitude in decimal degrees, north is positive
lng - longitude in decimal degrees, east is positive
course - Course over ground / COG, in degrees
speed - Speed, in kilometers per hour
altitude - Altitude, in meters
symbol - APRS symbol table and code
srccall - Source callsign - either APRS source callsign or AIS vessel callsign
dstcall - APRS packet destination callsign
comment - APRS comment or AIS destination and estimated time of arrival
path - APRS or AIS packet path
phg - APRS PHG value
status - Last status message transmitted by station
status_lasttime - The time when the last status message was received
Additional fields for AIS targets:

mmsi - AIS vessel MMSI number
imo - AIS vessel IMO number
vesselclass - AIS vessel class code
navstat - AIS navigational status code
heading - Heading
length - AIS vessel length in meters
width - AIS vessel width in meters
draught - AIS vessel draught in meters
ref_front - AIS vessel position reference distance from the front
ref_left - AIS vessel position reference distance from the left
Basic location query using XML:

https://api.aprs.fi/api/get?name=OH7RDA&what=loc&apikey=APIKEY&format=xml

<?xml version="1.0" encoding="utf-8"?>
<xml>
<command>get</command>
<result>ok</result>
<what>loc</what>
<found>1</found>
<entries>
	<entry>
		<name>OH7RDA</name>
		<type>l</type>
		<time>1267445689</time>
		<lasttime>1270580127</lasttime>
		<lat>63.06717</lat>
		<lng>27.66050</lng>
		<symbol>/#</symbol>
		<srccall>OH7RDA</srccall>
		<dstcall>APND12</dstcall>
		<phg>44603</phg>
		<comment>/R,W,Wn,Tn Siilinjarvi</comment>
		<path>WIDE2-2,qAR,OH7AA</path>
	</entry>
</entries>
</xml>
Querying multiple targets using a single request:

You can request data for up to 20 targets by separating the callsigns using a comma. The rate limiting limits the amount of API queries over time, not the amount of targets queried. Batch queries of multiple stations are faster for you and generate less load on the server.

https://api.aprs.fi/api/get?name=OH7RDA,OH7AA&what=loc&apikey=APIKEY&format=json

{
	"command":"get",
	"result":"ok",
	"what":"loc",
	"found":2,
	"entries": [
		{
			"name":"OH7RDA",
			... other data ...
		},
		{
			"name":"OH7AA"
			... other data ...
		}
	]
}
Querying weather data:

Again, all data is returned in metric format: temperatures in degrees Celsius, wind speed in meters per second. Multiple stations may be requested by separating callsigns using the comma character, like in location queries described above.

https://api.aprs.fi/api/get?name=OH2TI&what=wx&apikey=APIKEY&format=json

{
	"command":"get",
	"result":"ok",
	"what":"wx",
	"found":1,
	"entries": [
		{
			"name":"OH2TI",
			"time":"1270580978",
			"temp":"2.8",
			"pressure":"1022.1"
			"humidity":"88",
			"wind_direction":"270",
			"wind_speed":"2.7"
		}
	]
}
Fields:

temp - Temperature in degrees Celsius
time - Time of the last weather report
pressure - Atmospheric pressure, in millibars (mbar)
humidity - Relative air humidity, %
wind_direction - Average wind direction
wind_speed - Average wind speed, in meters per second
wind_gust - Wind gust, m/s
rain_1h - Rainfall over past 1 hour, in millimeters
rain_24h - Rainfall over past 24 hours, in mm
rain_mn - Rainfall since midnight, in mm
luminosity - Luminosity, watts / square meter (W/m^2)
Querying text messages:

This API call returns at most 10 latest APRS messages for the given recipient(s). Up to 10 recipients can be queried in a single call by separating the callsigns with a comma. The returned message ID can be used at your end to check whether new messages have been received since the last call.

https://api.aprs.fi/api/get?what=msg&dst=OH2TI&apikey=APIKEY&format=json

{
	"command":"get",
	"result":"ok",
	"found":2,
	"what":"msg",
	"entries": [
		{
			"messageid":"1271366",
			"time":"1272453795",
			"srccall":"OH5KUY-4",
			"dst":"OH2TI",
			"message":"foo bar"
		},
		{
			"messageid":"1271368",
			"time":"1272454795",
			"srccall":"OH5KUY-4",
			"dst":"OH2TI",
			"message":"bar foo"
		}
	]
}
Fields:

messageid - an incrementing id of the message (will wrap to 0 some day)
time - Time when the message was received
srccall - Source callsign
dst - APRS message destination
message - The message contents
Error reporting:

When a request fails, result is set to fail and a human-readable error message is returned in description. Please make sure your application handles errors gracefully, reports them back to the user, and writes them to a log file so that you can inspect them later. aprs.fi uses UTC time in log files, and so should you.

https://api.aprs.fi/api/get?name=OH2TI&what=wx&apikey=WRONGAPIKEY&format=json

{
	"command":"get",
	"result":"fail",
	"description":"authentication failed: wrong API key"
}
Happy hacking!