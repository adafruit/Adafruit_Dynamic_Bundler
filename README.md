# Adafruit_Dynamic_Bundler
Adafruit Dynamic Bundler for creating smaller packages

The URL is https://adafruit.github.io/Adafruit_Dynamic_Bundler/

## Parameters

 * **libs**: A comma separated list of libraries to include. These are the same format as the folder in the bundle.
 * **bundle**: The name of the bundle. Currently can be either `adafruit` or `circuitpython`, but defaults to `adafruit`.
 * **type**: The bundle type. Currently can be either `py` or `6mpy`, but defaults to `6mpy`.
 * **deps**: Whether to include dependencies. Currently can be either `1`, `0`, `true`, or `false`. Defaults to `true`.

## Examples
https://adafruit.github.io/Adafruit_Dynamic_Bundler/?libs=adafruit_ssd1305,adafruit_requests&type=py
https://adafruit.github.io/Adafruit_Dynamic_Bundler/?libs=adafruit_ili9341,adafruit_motor&deps=0
