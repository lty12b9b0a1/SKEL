const fs = require('fs');
const path = require('path');


expected_output1 = [
    {"start_file": 1, "end_file": 153, "start_log": 12049, "end_log": 12201},
    {"start_file": 154, "end_file": 336, "start_log": 12202, "end_log": 12384},
    {"start_file": 337, "end_file": 526, "start_log": 12385, "end_log": 12574},
    {"start_file": 527, "end_file": 708, "start_log": 12575, "end_log": 12756},
    {"start_file": 709, "end_file": 882, "start_log": 12757, "end_log": 12930},
    {"start_file": 883, "end_file": 1059, "start_log": 12931, "end_log": 13107},
    {"start_file": 1060, "end_file": 1241, "start_log": 13108, "end_log": 13289},
    {"start_file": 1242, "end_file": 1424, "start_log": 13290, "end_log": 13472},
    {"start_file": 1425, "end_file": 1601, "start_log": 13473, "end_log": 13649},
]

expected_output2 = [
    {"start_file": 1, "end_file": 91, "start_log": 1, "end_log": 91},
    {"start_file": 92, "end_file": 177, "start_log": 92, "end_log": 177},
    {"start_file": 178, "end_file": 260, "start_log": 178, "end_log": 260},
    {"start_file": 261, "end_file": 349, "start_log": 261, "end_log": 349},
    {"start_file": 350, "end_file": 441, "start_log": 350, "end_log": 441},
    {"start_file": 442, "end_file": 530, "start_log": 442, "end_log": 530},
    {"start_file": 531, "end_file": 622, "start_log": 531, "end_log": 622},
    {"start_file": 623, "end_file": 711, "start_log": 623, "end_log": 711},
    {"start_file": 712, "end_file": 802, "start_log": 712, "end_log": 802},
    {"start_file": 803, "end_file": 888, "start_log": 803, "end_log": 888},
    {"start_file": 889, "end_file": 976, "start_log": 889, "end_log": 976},
    {"start_file": 977, "end_file": 1063, "start_log": 977, "end_log": 1063},
    {"start_file": 1064, "end_file": 1148, "start_log": 1064, "end_log": 1148},
    {"start_file": 1149, "end_file": 1239, "start_log": 1149, "end_log": 1239},
    {"start_file": 1240, "end_file": 1327, "start_log": 1240, "end_log": 1327},
    {"start_file": 1328, "end_file": 1414, "start_log": 1328, "end_log": 1414},
    {"start_file": 1415, "end_file": 1501, "start_log": 1415, "end_log": 1501},
    {"start_file": 1502, "end_file": 1587, "start_log": 1502, "end_log": 1587},
    {"start_file": 1588, "end_file": 1682, "start_log": 1588, "end_log": 1682},
    {"start_file": 1683, "end_file": 1766, "start_log": 1683, "end_log": 1766},
    {"start_file": 1767, "end_file": 1847, "start_log": 1767, "end_log": 1847},
    {"start_file": 1848, "end_file": 1942, "start_log": 1848, "end_log": 1942},
    {"start_file": 1943, "end_file": 2027, "start_log": 1943, "end_log": 2027},
    {"start_file": 2028, "end_file": 2109, "start_log": 2028, "end_log": 2109},
    {"start_file": 2110, "end_file": 2201, "start_log": 2110, "end_log": 2201},
    {"start_file": 2202, "end_file": 2261, "start_log": 2202, "end_log": 2261},
]

expected_output3 = [
    "RootNode",
    null,
    [
        ["StreamStartNode"],
        [
            "TemplateInstanceNode",
            null,
            [
                [
                    "TemplateNode",
                    null,
                    [
                        ["StreamStartNode"],
                        [
                            "OpenStartElementNode",
                            "Event",
                            [
                                [
                                    "AttributeNode",
                                    "xmlns",
                                    [
                                        [
                                            "ValueNode",
                                            null,
                                            [
                                                [
                                                    "WstringTypeNode",
                                                    "http://schemas.microsoft.com/win/2004/08/events/event",
                                                ]
                                            ],
                                        ]
                                    ],
                                ],
                                ["CloseStartElementNode"],
                                [
                                    "OpenStartElementNode",
                                    "System",
                                    [
                                        ["CloseStartElementNode"],
                                        [
                                            "OpenStartElementNode",
                                            "Provider",
                                            [
                                                [
                                                    "AttributeNode",
                                                    "Name",
                                                    [
                                                        [
                                                            "ValueNode",
                                                            null,
                                                            [["WstringTypeNode", "Microsoft-Windows-Eventlog"]],
                                                        ]
                                                    ],
                                                ],
                                                [
                                                    "AttributeNode",
                                                    "Guid",
                                                    [
                                                        [
                                                            "ValueNode",
                                                            null,
                                                            [
                                                                [
                                                                    "WstringTypeNode",
                                                                    "{fc65ddd8-d6ef-4962-83d5-6e5cfe9ce148}",
                                                                ]
                                                            ],
                                                        ]
                                                    ],
                                                ],
                                                ["CloseEmptyElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "EventID",
                                            [
                                                ["AttributeNode", "Qualifiers", [["ConditionalSubstitutionNode"]]],
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Version",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Level",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Task",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Opcode",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Keywords",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "TimeCreated",
                                            [
                                                ["AttributeNode", "SystemTime", [["ConditionalSubstitutionNode"]]],
                                                ["CloseEmptyElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "EventRecordID",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ConditionalSubstitutionNode"],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Correlation",
                                            [
                                                ["AttributeNode", "ActivityID", [["ConditionalSubstitutionNode"]]],
                                                [
                                                    "AttributeNode",
                                                    "RelatedActivityID",
                                                    [["ConditionalSubstitutionNode"]],
                                                ],
                                                ["CloseEmptyElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Execution",
                                            [
                                                ["AttributeNode", "ProcessID", [["ConditionalSubstitutionNode"]]],
                                                ["AttributeNode", "ThreadID", [["ConditionalSubstitutionNode"]]],
                                                ["CloseEmptyElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Channel",
                                            [
                                                ["CloseStartElementNode"],
                                                ["ValueNode", null, [["WstringTypeNode", "System"]]],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Computer",
                                            [
                                                ["CloseStartElementNode"],
                                                [
                                                    "ValueNode",
                                                    null,
                                                    [["WstringTypeNode", "WKS-WIN764BITB.shieldbase.local"]],
                                                ],
                                                ["CloseElementNode"],
                                            ],
                                        ],
                                        [
                                            "OpenStartElementNode",
                                            "Security",
                                            [
                                                ["AttributeNode", "UserID", [["ConditionalSubstitutionNode"]]],
                                                ["CloseEmptyElementNode"],
                                            ],
                                        ],
                                        ["CloseElementNode"],
                                    ],
                                ],
                                [
                                    "OpenStartElementNode",
                                    "UserData",
                                    [
                                        ["CloseStartElementNode"],
                                        ["ConditionalSubstitutionNode"],
                                        ["CloseElementNode"],
                                    ],
                                ],
                                ["CloseElementNode"],
                            ],
                        ],
                        ["EndOfStreamNode"],
                    ],
                ]
            ],
        ],
        [
            "Substitutions",
            null,
            [
                ["UnsignedByteTypeNode", "4"],
                ["UnsignedByteTypeNode", "0"],
                ["UnsignedWordTypeNode", "105"],
                ["UnsignedWordTypeNode", "105"],
                ["NullTypeNode"],
                ["Hex64TypeNode", "0x8000000000000000"],
                ["FiletimeTypeNode", "time not supported"],
                ["NullTypeNode"],
                ["UnsignedDwordTypeNode", "820"],
                ["UnsignedDwordTypeNode", "2868"],
                ["UnsignedQwordTypeNode", "12049"],
                ["UnsignedByteTypeNode", "0"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                ["NullTypeNode"],
                [
                    "BXmlTypeNode",
                    null,
                    [
                        [
                            "RootNode",
                            null,
                            [
                                ["StreamStartNode"],
                                [
                                    "TemplateInstanceNode",
                                    null,
                                    [
                                        [
                                            "TemplateNode",
                                            null,
                                            [
                                                ["StreamStartNode"],
                                                [
                                                    "OpenStartElementNode",
                                                    "AutoBackup",
                                                    [
                                                        [
                                                            "AttributeNode",
                                                            "xmlns:auto-ns3",
                                                            [
                                                                [
                                                                    "ValueNode",
                                                                    null,
                                                                    [
                                                                        [
                                                                            "WstringTypeNode",
                                                                            "http://schemas.microsoft.com/win/2004/08/events",
                                                                        ]
                                                                    ],
                                                                ]
                                                            ],
                                                        ],
                                                        [
                                                            "AttributeNode",
                                                            "xmlns",
                                                            [
                                                                [
                                                                    "ValueNode",
                                                                    null,
                                                                    [
                                                                        [
                                                                            "WstringTypeNode",
                                                                            "http://manifests.microsoft.com/win/2004/08/windows/eventlog",
                                                                        ]
                                                                    ],
                                                                ]
                                                            ],
                                                        ],
                                                        ["CloseStartElementNode"],
                                                        [
                                                            "OpenStartElementNode",
                                                            "Channel",
                                                            [
                                                                ["CloseStartElementNode"],
                                                                ["NormalSubstitutionNode"],
                                                                ["CloseElementNode"],
                                                            ],
                                                        ],
                                                        [
                                                            "OpenStartElementNode",
                                                            "BackupPath",
                                                            [
                                                                ["CloseStartElementNode"],
                                                                ["NormalSubstitutionNode"],
                                                                ["CloseElementNode"],
                                                            ],
                                                        ],
                                                        ["CloseElementNode"],
                                                    ],
                                                ],
                                                ["EndOfStreamNode"],
                                            ],
                                        ]
                                    ],
                                ],
                                [
                                    "Substitutions",
                                    null,
                                    [
                                        ["WstringTypeNode", "System"],
                                        [
                                            "WstringTypeNode",
                                            "C:\\Windows\\System32\\Winevt\\Logs\\Archive-System-2012-03-14-04-17-39-932.evtx",
                                        ],
                                    ],
                                ],
                            ],
                        ]
                    ],
                ],
            ],
        ],
    ],
]



expected_output4 = `\
<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event"><System><Provider Name="Microsoft-Windows-Eventlog" Guid="{fc65ddd8-d6ef-4962-83d5-6e5cfe9ce148}"></Provider>
<EventID Qualifiers="">105</EventID>
<Version>0</Version>
<Level>4</Level>
<Task>105</Task>
<Opcode>0</Opcode>
<Keywords>0x8000000000000000</Keywords>
<TimeCreated SystemTime="time not supported"></TimeCreated>
<EventRecordID>12049</EventRecordID>
<Correlation ActivityID="" RelatedActivityID=""></Correlation>
<Execution ProcessID="820" ThreadID="2868"></Execution>
<Channel>System</Channel>
<Computer>WKS-WIN764BITB.shieldbase.local</Computer>
<Security UserID=""></Security>
</System>
<UserData><AutoBackup xmlns:auto-ns3="http://schemas.microsoft.com/win/2004/08/events" xmlns="http://manifests.microsoft.com/win/2004/08/windows/eventlog"><Channel>System</Channel>
<BackupPath>C:\\Windows\\System32\\Winevt\\Logs\\Archive-System-2012-03-14-04-17-39-932.evtx</BackupPath>
</AutoBackup>
</UserData>
</Event>
`

function systemPath() {
    /**
     * Fetch the file system path of the system.evtx test file.
     * 
     * @returns {string} The file system path of the test file.
     */
    const cd = path.dirname(__filename);
    const datadir = path.join(cd, "evtx_data");
    return path.join(datadir, "system.evtx");
}

function system() {
    /**
     * Reads the contents of the system.evtx test file.
     * 
     * @returns {Buffer} The contents of the test file as a Buffer.
     */
    const p = systemPath();
    return fs.readFileSync(p);
}

function securityPath() {
    /**
     * Fetch the file system path of the security.evtx test file.
     * 
     * @returns {string} The file system path of the test file.
     */
    const cd = path.dirname(__filename);
    const datadir = path.join(cd, "evtx_data");
    return path.join(datadir, "security.evtx");
}

function* user_infinite_counter(){
    var start = 0;
    while (true){
        yield start;
        start += 1;
    }
}

function security() {
    /**
     * Reads the contents of the security.evtx test file.
     * 
     * @returns {Buffer} The contents of the test file as a Buffer.
     */
    const p = securityPath();
    return fs.readFileSync(p);
}

function dataPath() {
    /**
     * Fetch the file system path of the directory containing test files.
     * 
     * @returns {string} The file system path of the test directory.
     */
    const cd = path.dirname(__filename);
    const datadir = path.join(cd, "evtx_data");
    return datadir;
}

function get_input(caseType) {
    if (caseType === "case1") {
        return system();
    } else {
        return security();
    }
}


NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_\-:]*$/;

module.exports = {get_input, user_infinite_counter, expected_output1, expected_output2, expected_output3, expected_output4, NAME_PATTERN};
