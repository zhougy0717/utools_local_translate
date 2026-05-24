# PlantUML Lint 测试用例

## Block 1: 正常块（应无变化）

```plantuml
@startuml
Alice -> Bob
@enduml
```

## Block 2: 缺少 @startuml 和 @enduml（应补全）

````plantuml
@startuml
Alice -> Bob: Hello
@enduml
````

## Block 3: 缺少 @enduml（应补全）

```plantuml
@startuml
Bob -> Alice: How are you?
@enduml
```

## Block 4: 未闭合引号（应自动补全）

```plantuml
@startuml
Charlie -> Dave: "Hello World"
@enduml
```

## Block 5: 缺少 endif（启发式修复）

```plantuml
@startuml
Eve -> Mallory: Check
if (success then)
  Eve -> Mallory: Good!
@enduml
```

## Block 6: 未定义 participant（应自动声明）

```plantuml
@startuml
UnknownUser -> AnotherUser: Hi there
@enduml
```

## Block 7: puml 语言别名（应转为 plantuml 围栏）

```plantuml
@startuml
A -> B: Test alias
@enduml
```

## Block 8: 全角箭头（应标准化）

```plantuml
@startuml
X -> Y: Full -> width arrow
Z --> W: Em -> dash arrow
@enduml
```

## Block 9: 多错误叠加（引号 + 缺 end + 未定义 participant）

```plantuml
@startuml
Ghost -> Phantom: "Attack string"
if (hack then)
  Ghost -> Phantom: Pwned
@enduml
```

## Block 10: 空 block（应填充最小有效结构）

```plantuml
@startuml
@enduml
```
