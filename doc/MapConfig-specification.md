MapConfig is a document used to create maps in Windshaft,
via the [MultiLayer API](Multilayer-API.md)

Latest version of the document: [MapConfig-1.5.0](MapConfig-1.5.0.md)

The identifier of created maps can then be used to fetch different resources
(availability of which depends on the map configuration):

  - Tiles
    - Identified by {z}/{x}/{y} path
    - Possibly additionally identified by :LAYER_NUMBER
    - Can be of different formats (TODO: href each format...):
        * png
        * grid.json
        * torque.json
  - Static images/previews
    - With a center or a bounding box
  - Attributes
    - Identified by LAYER_NUMBER and FEATURE_ID
