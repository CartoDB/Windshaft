#!/bin/bash

if [[ "$OSTYPE" == "darwin"* ]]; then
    export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:/opt/X11/lib/pkgconfig
    CAIRO_PKG_CONFIG=`pkg-config cairo --cflags-only-I 2> /dev/null`
    RESULT=$?

    if [[ ${RESULT} -ne 0 ]]; then
        echo "###################################################################################"
        echo "#                            PREINSTALL HOOK ERROR                                #"
        echo "#---------------------------------------------------------------------------------#"
        echo "#                                                                                 #"
        echo "# node-canvas install error: some packages required by 'cairo' are not found      #"
        echo "#                                                                                 #"
        echo -e "# Use '\033[1mmake all\033[0m', it will take care of common/known issues                        #"
        echo "#                                                                                 #"
        echo "# As an alternative try:                                                          #"
        echo "# Try to 'export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:/opt/X11/lib/pkgconfig' #"
        echo "#                                                                                 #"
        echo "# If problems persist visit: https://github.com/Automattic/node-canvas/wiki       #"
        echo "#                                                                                 #"
        echo "###################################################################################"
        exit 1
    fi
fi
