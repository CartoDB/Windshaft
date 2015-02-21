MapConfig is a document used to create maps in Windshaft,
via the [MultiLayer API](Multilayer-API.md)

Latest version of the document: [MapConfig-1.3.0](MapConfig-1.3.0.md)

The identifier of created maps can then be used to fetch different resources
(availability of which depends on the map configuration):

  - Tiles
    - Identified by {z}/{x}/{y} path
    - Possibly additionally identified by :LAYER_NUMBER
    - Can be of different formats (TODO: href each format...):
        * png
        * grid.json
        * torque.json, torque.bin, torque.png
        * http.png
 - Metadata
   - format dependent on layer.type
     - mapnik layers: (no metadata)
     - torque layers:
```
{
    // integer, min value for time column (in millis for time columns of date type)
    "start": 123123123,
    // integer, max value for time column (in millis). Must be greater or equal than start
    "end": 123123124,
    // integer, animation steps calculated, should be less or equal than -torque-max-steps
    "steps": 512,
    // time column type, can be "date" or "number"
    "columnType": "number"
}
```
 - Attributes
   - Identified by LAYER_NUMBER and FEATURE_ID
