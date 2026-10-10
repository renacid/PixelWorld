/** 洞窟工房で編集できる固定地形。各階の倍率・配置はfloorSettingsで設定。 */
import type { Stage } from "../../game/types";
export const stage: Stage = {
  "id": 16,
  "code": "3-5",
  "regionId": "cave",
  "name": "洞窟 3-5",
  "subtitle": "地底に眠る古木",
  "description": "熔けた岩の坑道を抜け、地下水に育まれた森の主へ挑む。",
  "objective": "地底の森の奥へ進もう",
  "vision": 5,
  "width": 44,
  "height": 40,
  "enemyCount": 0,
  "sleepRespawnCount": 3,
  "dungeon": {
    "floors": 4,
    "gemCount": 1,
    "extraPassages": 0,
    "enemyVariance": 0,
    "nightRevival": {
      "min": 1,
      "max": 2
    }
  },
  "floorSettings": {
    "1": {
      "enemyMultiplier": 1,
      "width": 44,
      "height": 40,
      "objective": "地底の森の奥へ進もう",
      "clearCondition": {
        "type": "exit"
      },
      "enemySpawns": [],
      "trapPlacements": [],
      "installationPlacements": [],
      "skillBooks": {
        "max": 2,
        "extraChance": 0.3
      },
      "layout": {
        "rows": [
          "############################################",
          "############################################",
          "############################################",
          "###################################.########",
          "#################################...,.######",
          "#######.########################,.....,#####",
          "#####..,..#####################...,.....####",
          "####.....,....,.....,...########....,..#####",
          "###..,.....,....,.....,.#########,....######",
          "####...,.....,....,.....,.#########,########",
          "#####....,#######...,.....,.#######.########",
          "#######.#.#######,....,.....,....,...#######",
          "#########.######...,....,.....,....,.#######",
          "#########.#######....,....,.....,....#######",
          "#########.#######,.....,....#####.,...######",
          "#########.#########,.....,######....,..#####",
          "#########.############.##.######,.....,#####",
          "#########.###############.######..,....#####",
          "#########,###############,#####,....,...####",
          "#########.###############.######.,....,#####",
          "######.,.....############.######...,...#####",
          "#####....,....###########.######.....,.#####",
          "#####.,....,..###########.#######,....######",
          "####....,....,.##########.#########,########",
          "#####.....,...###########.#########.########",
          "#####.,.....,.###########.#########.########",
          "######..,....#########...,...######.########",
          "########..,#########.,.....,...####.########",
          "########...#########...,.....,.####.########",
          "########.,....,.....,....,.....,....########",
          "########...#########..,....,...#############",
          "######.#...#########....,....,.#############",
          "####,....,.###########....,..###############",
          "###...,....##############.##################",
          "##,.....,..#################################",
          "###.,.....,#################################",
          "####..,..###################################",
          "######.#####################################",
          "############################################",
          "############################################"
        ],
        "legend": {
          "#": 9,
          ".": 7,
          ",": 8,
          "g": 3,
          "T": 4,
          "~": 5,
          "G": 0,
          "X": 10
        },
        "spawn": {
          "x": 6,
          "y": 34
        },
        "objects": [
          {
            "id": "exit",
            "type": "exit",
            "position": {
              "x": 35,
              "y": 6
            }
          },
          {
            "id": "start-attack",
            "type": "chest",
            "chestTier": "gold",
            "position": {
              "x": 7,
              "y": 34
            },
            "skillId": "attack",
            "skillIds": [
              "warp",
              "sweep",
              "transferGate"
            ]
          },
          {
            "id": "gem",
            "type": "gem",
            "position": {
              "x": 35,
              "y": 5
            }
          },
          {
            "id": "dead-end-chest",
            "type": "chest",
            "chestTier": "gold",
            "position": {
              "x": 7,
              "y": 8
            }
          },
          {
            "id": "book",
            "type": "skillBook",
            "position": {
              "x": 25,
              "y": 29
            }
          }
        ],
        "enemies": [
          {
            "kind": "bombStone",
            "position": {
              "x": 9,
              "y": 23
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 25,
              "y": 28
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 35,
              "y": 18
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 9,
              "y": 22
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 24,
              "y": 29
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 35,
              "y": 17
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 26,
              "y": 29
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 25,
              "y": 30
            }
          }
        ],
        "installations": [
          {
            "id": "pot-0",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 8,
              "y": 23
            }
          },
          {
            "id": "pot-1",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 25,
              "y": 27
            }
          },
          {
            "id": "pot-2",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 34,
              "y": 18
            }
          },
          {
            "id": "pot-3",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 22,
              "y": 12
            }
          }
        ],
        "traps": [
          {
            "id": "trap-0",
            "trapId": "largeRock",
            "position": {
              "x": 10,
              "y": 23
            },
            "triggered": false
          },
          {
            "id": "trap-1",
            "trapId": "stoneSlimeShower",
            "position": {
              "x": 24,
              "y": 28
            },
            "triggered": false
          },
          {
            "id": "trap-2",
            "trapId": "fireMine",
            "position": {
              "x": 36,
              "y": 18
            },
            "triggered": false
          },
          {
            "id": "trap-3",
            "trapId": "healing",
            "position": {
              "x": 22,
              "y": 11
            },
            "triggered": false
          },
          {
            "id": "trap-4",
            "trapId": "manaHealing",
            "position": {
              "x": 34,
              "y": 6
            },
            "triggered": false
          }
        ],
        "randomEnemies": [],
        "randomChests": 1,
        "gemCount": 1,
        "trapPlacements": []
      }
    },
    "2": {
      "enemyMultiplier": 1.3,
      "width": 46,
      "height": 42,
      "objective": "地底の森の奥へ進もう",
      "clearCondition": {
        "type": "exit"
      },
      "enemySpawns": [],
      "trapPlacements": [],
      "installationPlacements": [],
      "skillBooks": {
        "max": 2,
        "extraChance": 0.3
      },
      "layout": {
        "rows": [
          "##############################################",
          "##############################################",
          "##############################################",
          "######,#######################################",
          "####,...,###########,##############.##########",
          "###..,,...#######,...,,.########,,....,#######",
          "##,....,,..####...,,...,,.#####...,,....######",
          "###,,....,,...,,..~.,,...,#####,,...,,..######",
          "####.,,....,,...,,~...,,...,,....~,...,,######",
          "#####..,,....,,...,,....,,####,..~.,,...,#####",
          "######.########,,...,,....#####,,....,,.######",
          "######,##########,,...,,#######..,,....,######",
          "######.#############,##########,...,,...######",
          "######.#############.###########,,...,,#######",
          "######,#############.##############,##########",
          "######.#############,##############.##########",
          "######,#############.##############.##########",
          "######.#############.##############,##########",
          "######.#############,##############.##########",
          "######,#############.##############..#########",
          "######.#############.############..,,...######",
          "######.#.###########,##########,,....,,...####",
          "#####.,,...,#######...,,....,,...,~....,,.####",
          "####....,,...######,,...,,....,,..~,,....,,###",
          "####,,~...,,.######..,,...,,....,,...,,...####",
          "###...~,....,,...,,...#########...,,...,,.####",
          "####,...,,...######,,.###########...,,..######",
          "####.,,...,,.####,...,,.############.#########",
          "#####..,,...####..,,...,,#####################",
          "#######..#######....,,...#####################",
          "#######.########,,~...,,.#####################",
          "#######,#######...~,....,,####################",
          "#######.########,...,,...#############,#######",
          "#######,########.,,...,,.###########...,,#####",
          "#######.########...,,...,,....,,...,~....,####",
          "#####,....#######....,,...,,....,,..~,,....###",
          "####..,,...########....,,...,,....,,...,,.####",
          "#####...,,##########################,,...#####",
          "#######.##############################,#######",
          "##############################################",
          "##############################################",
          "##############################################"
        ],
        "legend": {
          "#": 9,
          ".": 7,
          ",": 8,
          "g": 3,
          "T": 4,
          "~": 5,
          "G": 0,
          "X": 10
        },
        "spawn": {
          "x": 6,
          "y": 6
        },
        "objects": [
          {
            "id": "exit",
            "type": "exit",
            "position": {
              "x": 38,
              "y": 35
            }
          },
          {
            "id": "gem",
            "type": "gem",
            "position": {
              "x": 38,
              "y": 34
            }
          },
          {
            "id": "dead-end-chest",
            "type": "chest",
            "chestTier": "gold",
            "position": {
              "x": 7,
              "y": 36
            }
          },
          {
            "id": "book",
            "type": "skillBook",
            "position": {
              "x": 35,
              "y": 9
            }
          }
        ],
        "enemies": [
          {
            "kind": "bombStone",
            "position": {
              "x": 20,
              "y": 8
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 35,
              "y": 8
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 36,
              "y": 23
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 20,
              "y": 31
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 20,
              "y": 7
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 34,
              "y": 9
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 36,
              "y": 22
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 36,
              "y": 9
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 35,
              "y": 23
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 35,
              "y": 10
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 37,
              "y": 23
            }
          },
          {
            "kind": "greaterCrystalFlower",
            "position": {
              "x": 36,
              "y": 24
            }
          }
        ],
        "installations": [
          {
            "id": "pot-0",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 19,
              "y": 8
            }
          },
          {
            "id": "pot-1",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 35,
              "y": 7
            }
          },
          {
            "id": "pot-2",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 36,
              "y": 21
            }
          },
          {
            "id": "pot-3",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 20,
              "y": 30
            }
          }
        ],
        "traps": [
          {
            "id": "trap-0",
            "trapId": "largeRock",
            "position": {
              "x": 21,
              "y": 8
            },
            "triggered": false
          },
          {
            "id": "trap-1",
            "trapId": "stoneSlimeShower",
            "position": {
              "x": 34,
              "y": 8
            },
            "triggered": false
          },
          {
            "id": "trap-2",
            "trapId": "fireMine",
            "position": {
              "x": 35,
              "y": 22
            },
            "triggered": false
          },
          {
            "id": "trap-3",
            "trapId": "healing",
            "position": {
              "x": 19,
              "y": 31
            },
            "triggered": false
          },
          {
            "id": "trap-4",
            "trapId": "manaHealing",
            "position": {
              "x": 8,
              "y": 25
            },
            "triggered": false
          }
        ],
        "randomEnemies": [],
        "randomChests": 1,
        "gemCount": 1,
        "trapPlacements": []
      }
    },
    "3": {
      "enemyMultiplier": 1.6,
      "width": 48,
      "height": 44,
      "objective": "地底の森の奥へ進もう",
      "clearCondition": {
        "type": "exit"
      },
      "enemySpawns": [],
      "trapPlacements": [],
      "installationPlacements": [],
      "skillBooks": {
        "max": 2,
        "extraChance": 0.3
      },
      "layout": {
        "rows": [
          "################################################",
          "################################################",
          "################################################",
          "#######g########################################",
          "#####g..gg##############.#######################",
          "####.ggg..g##########ggg..Tg############g#######",
          "###g...ggg..ggg...ggg.~ggg...#########..ggg#####",
          "####gg...ggg..ggg...gg~..ggg...ggg..ggg...gg####",
          "#####ggg...ggg..ggg...ggg..gg########.ggg.T.####",
          "#######g#############.T.ggg.#########g~.ggg.####",
          "#######.################.###########.g~g..ggg###",
          "#######g#############################..ggg..####",
          "#######.#############################gT..ggg####",
          "#######.###g#########################ggg...g####",
          "#######gg...ggg#######################.ggg.#####",
          "#######.ggg...gg###########g############.#######",
          "######gg..gggT..g######g...ggg..########g#######",
          "######.gg~..ggg..#####.ggg...ggg.#######g#######",
          "#####g...~gg..ggg.###gg..ggg.T.ggg######.#######",
          "######gg...ggg..ggg...ggg~.ggg...g######g#######",
          "######.ggT...ggg..ggg...g~g..ggg...ggg..g#######",
          "#######..ggg...ggg..ggg...ggg..ggg##############",
          "########g..ggg.######.gggT..ggg..g##############",
          "###########.##########..ggg...ggg###############",
          "###########g###########g..ggg...################",
          "###########.###############.####################",
          "###########.###############g####################",
          "###########g###############g####################",
          "#########g#.###############.####################",
          "######...ggg.#############gg####################",
          "####.ggg...Tgg.########gg..ggg##################",
          "####g..~gg...gg#######..ggg..gg#################",
          "###.ggg~.ggg...ggg..ggg...ggT..#########.#######",
          "####..ggg..ggg.#######gg~...ggg#######.ggg.#####",
          "####g..Tggg..gg######g..~gg...gg#####g...ggg####",
          "######g...ggg#########gg..ggg...ggg..ggg...g####",
          "#########.############.gTg..ggg...ggg..ggg...###",
          "######################...ggg..ggg...ggg..ggg####",
          "#######################g...ggg#######.ggg..g####",
          "##########################.###########..ggg#####",
          "########################################.#######",
          "################################################",
          "################################################",
          "################################################"
        ],
        "legend": {
          "#": 9,
          ".": 7,
          ",": 8,
          "g": 3,
          "T": 4,
          "~": 5,
          "G": 0,
          "X": 10
        },
        "spawn": {
          "x": 40,
          "y": 36
        },
        "objects": [
          {
            "id": "exit",
            "type": "exit",
            "position": {
              "x": 7,
              "y": 6
            }
          },
          {
            "id": "gem",
            "type": "gem",
            "position": {
              "x": 24,
              "y": 7
            }
          },
          {
            "id": "dead-end-chest",
            "type": "chest",
            "chestTier": "gold",
            "position": {
              "x": 7,
              "y": 5
            }
          },
          {
            "id": "book",
            "type": "skillBook",
            "position": {
              "x": 9,
              "y": 32
            }
          }
        ],
        "enemies": [
          {
            "kind": "bombStone",
            "position": {
              "x": 26,
              "y": 34
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 9,
              "y": 31
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 11,
              "y": 18
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 27,
              "y": 20
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 40,
              "y": 10
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 26,
              "y": 33
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 8,
              "y": 32
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 11,
              "y": 17
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 10,
              "y": 32
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 10,
              "y": 18
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 27,
              "y": 19
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 9,
              "y": 33
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 12,
              "y": 18
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 26,
              "y": 20
            }
          },
          {
            "kind": "greaterCrystalFlower",
            "position": {
              "x": 11,
              "y": 19
            }
          },
          {
            "kind": "treant",
            "position": {
              "x": 28,
              "y": 20
            }
          },
          {
            "kind": "greaterCrystalFlower",
            "position": {
              "x": 27,
              "y": 34
            }
          }
        ],
        "installations": [
          {
            "id": "pot-0",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 25,
              "y": 34
            }
          },
          {
            "id": "pot-1",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 9,
              "y": 30
            }
          },
          {
            "id": "pot-2",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 11,
              "y": 16
            }
          },
          {
            "id": "pot-3",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 27,
              "y": 21
            }
          }
        ],
        "traps": [
          {
            "id": "trap-0",
            "trapId": "largeRock",
            "position": {
              "x": 26,
              "y": 35
            },
            "triggered": false
          },
          {
            "id": "trap-1",
            "trapId": "stoneSlimeShower",
            "position": {
              "x": 8,
              "y": 31
            },
            "triggered": false
          },
          {
            "id": "trap-2",
            "trapId": "fireMine",
            "position": {
              "x": 10,
              "y": 17
            },
            "triggered": false
          },
          {
            "id": "trap-3",
            "trapId": "healing",
            "position": {
              "x": 27,
              "y": 18
            },
            "triggered": false
          },
          {
            "id": "trap-4",
            "trapId": "manaHealing",
            "position": {
              "x": 40,
              "y": 9
            },
            "triggered": false
          }
        ],
        "randomEnemies": [],
        "randomChests": 1,
        "gemCount": 1,
        "trapPlacements": []
      }
    },
    "4": {
      "enemyMultiplier": 1.9,
      "width": 44,
      "height": 72,
      "objective": "エルダー・トレントを倒そう",
      "clearCondition": {
        "type": "defeat",
        "kind": "elderTreant",
        "count": 1
      },
      "enemySpawns": [],
      "trapPlacements": [],
      "installationPlacements": [],
      "skillBooks": {
        "max": 2,
        "extraChance": 0.3
      },
      "layout": {
        "rows": [
          "############################################",
          "############################################",
          "##################TTTTTTTTT#################",
          "#################TTTTTgTTTTT################",
          "################TTTGGgGGGGTTT###############",
          "###############TTGGGggggGgGGTT##############",
          "##############TTGGGgGggggGGGGTT#############",
          "#############TTGGGgGGgggGGGGgGTT############",
          "#############TTGGgGGGgggGGGgGGTT############",
          "############TTGGgGGGGgggGGgGGGGTT###########",
          "############TTGgGGGGggggGgGGGGgTT###########",
          "############TGgGGGGgGggggGGGGgGGT###########",
          "###########TTgGGTGgGGgggGGGGgGGGTT##########",
          "###########TTGGGGgGGGgggGGGgGGGGTT##########",
          "###########TTGGGgGGGGgggGGgGTGGgTT##########",
          "###########TTGGgGGGGggggGgGGGGgGTT##########",
          "###########TGGgGGGGgGggggGGGGgGGGT##########",
          "###########TTgGGGGgGGgggGGGGgGGGTT##########",
          "###########TTGGGGgGGGgggGGGgGGGGTT##########",
          "###########TTGGGgGGGGgggGGgGGGGgTT##########",
          "###########TTGGgGGGGggggGgGGGGgGTT##########",
          "############TGgGGGGgGggggGGGGgGGT###########",
          "############TTGGGTgGGgggGGGGgGGTT###########",
          "############TTGGGgGGGgggGGGTGGGTT###########",
          "#############TTGgGGGGgggGGgGGGTT############",
          "#############TTgGGGGggggGgGGGGTT############",
          "##############TTGGGgGggggGGGGTT#############",
          "###############TTGgGGgggGGGGTT##############",
          "################TTTGGgggGGTTT###############",
          "#################TTTTgggTTTT################",
          "########g#########TTTgggTTT#################",
          "######.gggg#########ggggg###################",
          "#####ggg.gTg########gggg.###################",
          "#####.~ggg.gggg..gggg.gggg##################",
          "####gg~.gggg.#######ggg.g###################",
          "#####ggg..gg########.gggg###################",
          "#####.Tggg..##########.#####################",
          "######g.ggg###########g#####################",
          "#######gg.############g#####################",
          "#######ggg############.#####################",
          "#######..g########.###g#####################",
          "#######gg.#####.gggg..g#####################",
          "#######ggg####ggg.gggg.###########.#########",
          "#######g.g###..gggg.Tggg#######gggg..g######",
          "#######ggg.gggg.~gggg.gg######gg.gggg..#####",
          "#######.gggg.ggg~..gggg.gggg..gggg.gTgg#####",
          "#######g..gggg.gggg..ggg######..~ggg.gg#####",
          "#############gggTgggg..g#####ggg~.gggg.g####",
          "##############gggg.gggg#######gggg..ggg#####",
          "###############.gggg.g########g.Tggg..g#####",
          "##################g###########ggg.gggg.#####",
          "###############################gggg.gg######",
          "##################################g#########",
          "##################################.#########",
          "##################################g#########",
          "##################################g#########",
          "##################################.#########",
          "###########################g######g#########",
          "########################ggg.ggg###g#########",
          "######################g..ggggTggg#.#########",
          "#######gg.gggg..gggg.gggg~.gggg.g#g#########",
          "#######gggg.gggg..gggg.gg~g..gggg.g#########",
          "#######..gggg.gggg..gggg.gggg..gg###########",
          "#####gggg..g##########gggT.gggg..###########",
          "####gg.gggg..###########gggg.gg#############",
          "###.gggg.gggg.#############g################",
          "####..gggg.gg###############################",
          "#####g..gggg################################",
          "########.###################################",
          "############################################",
          "############################################",
          "############################################"
        ],
        "legend": {
          "#": 9,
          ".": 7,
          ",": 8,
          "g": 3,
          "T": 4,
          "~": 5,
          "G": 0,
          "X": 10
        },
        "spawn": {
          "x": 8,
          "y": 65
        },
        "objects": [
          {
            "id": "exit",
            "type": "exit",
            "position": {
              "x": 22,
              "y": 4
            }
          },
          {
            "id": "gem",
            "type": "gem",
            "position": {
              "x": 8,
              "y": 34
            }
          },
          {
            "id": "dead-end-chest",
            "type": "chest",
            "chestTier": "gold",
            "position": {
              "x": 22,
              "y": 33
            }
          },
          {
            "id": "book",
            "type": "skillBook",
            "position": {
              "x": 34,
              "y": 47
            }
          }
        ],
        "enemies": [
          {
            "kind": "bombStone",
            "position": {
              "x": 27,
              "y": 61
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 34,
              "y": 46
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 18,
              "y": 45
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 8,
              "y": 33
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 27,
              "y": 60
            }
          },
          {
            "kind": "bombStone",
            "position": {
              "x": 33,
              "y": 47
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 26,
              "y": 61
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 35,
              "y": 47
            }
          },
          {
            "kind": "stoneSlime",
            "position": {
              "x": 18,
              "y": 44
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 34,
              "y": 48
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 17,
              "y": 45
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 7,
              "y": 34
            }
          },
          {
            "kind": "earthFlower",
            "position": {
              "x": 34,
              "y": 45
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 33,
              "y": 46
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 19,
              "y": 45
            }
          },
          {
            "kind": "thunderButterfly",
            "position": {
              "x": 9,
              "y": 34
            }
          },
          {
            "kind": "greaterCrystalFlower",
            "position": {
              "x": 18,
              "y": 46
            }
          },
          {
            "kind": "treant",
            "position": {
              "x": 8,
              "y": 35
            }
          },
          {
            "kind": "greaterCrystalFlower",
            "position": {
              "x": 28,
              "y": 61
            }
          },
          {
            "kind": "elderTreant",
            "position": {
              "x": 21,
              "y": 5
            }
          }
        ],
        "installations": [
          {
            "id": "pot-0",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 27,
              "y": 62
            }
          },
          {
            "id": "pot-1",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 35,
              "y": 46
            }
          },
          {
            "id": "pot-2",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 18,
              "y": 43
            }
          },
          {
            "id": "pot-3",
            "kind": "pot",
            "spawned": 0,
            "position": {
              "x": 8,
              "y": 32
            }
          }
        ],
        "traps": [
          {
            "id": "trap-0",
            "trapId": "largeRock",
            "position": {
              "x": 27,
              "y": 59
            },
            "triggered": false
          },
          {
            "id": "trap-1",
            "trapId": "stoneSlimeShower",
            "position": {
              "x": 36,
              "y": 47
            },
            "triggered": false
          },
          {
            "id": "trap-2",
            "trapId": "fireMine",
            "position": {
              "x": 17,
              "y": 44
            },
            "triggered": false
          },
          {
            "id": "trap-3",
            "trapId": "healing",
            "position": {
              "x": 7,
              "y": 33
            },
            "triggered": false
          },
          {
            "id": "trap-4",
            "trapId": "manaHealing",
            "position": {
              "x": 22,
              "y": 32
            },
            "triggered": false
          }
        ],
        "randomEnemies": [],
        "randomChests": 1,
        "gemCount": 1,
        "trapPlacements": [],
        "bossArena": {
          "x": 12,
          "y": 3,
          "width": 21,
          "height": 27,
          "sealTiles": [
            {
              "x": 21,
              "y": 30
            },
            {
              "x": 22,
              "y": 30
            },
            {
              "x": 23,
              "y": 30
            }
          ],
          "wallTile": 4
        }
      }
    }
  }
};
