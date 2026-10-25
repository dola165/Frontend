import type { Copy } from './imageEditorWords';

/**
 * The editor library's own words, ours in English and Georgian. Only what our tools show is listed; the library never
 * fetches translations from its vendor (useBackendTranslations is off).
 */
export const editorTranslations = (copy: Copy) => ({
    save: copy('Save as new', 'ახლის შენახვა'), cancel: copy('Cancel', 'გაუქმება'), apply: copy('Apply', 'გამოყენება'),
    confirm: copy('Confirm', 'დადასტურება'), warning: copy('Warning', 'გაფრთხილება'), loading: copy('Loading…', 'იტვირთება…'),
    discardChanges: copy('Discard changes', 'ცვლილებების გაუქმება'), resetOperations: copy('Start over', 'თავიდან დაწყება'),
    changesLoseWarningHint: copy('Everything you changed will be undone.', 'ყველა ცვლილება გაუქმდება.'),
    undoTitle: copy('Undo (Ctrl+Z)', 'დაბრუნება (Ctrl+Z)'), redoTitle: copy('Redo (Ctrl+Shift+Z)', 'გამეორება (Ctrl+Shift+Z)'),
    showImageTitle: copy('Hold to see the original', 'დააჭირეთ ორიგინალის სანახავად'),
    zoomInTitle: copy('Zoom in', 'გადიდება'), zoomOutTitle: copy('Zoom out', 'დაპატარავება'), fitTitle: copy('Fit', 'მორგება'),
    toggleZoomMenuTitle: copy('Zoom', 'მასშტაბი'), actualSize: copy('Actual size (100%)', 'რეალური ზომა (100%)'), fitSize: copy('Fit', 'მორგება'),
    adjustTab: copy('Crop', 'ჭრა'), annotateTabLabel: copy('Draw', 'ხატვა'), aiTab: copy('Blur', 'დაბინდვა'),
    cropTool: copy('Crop', 'ჭრა'), original: copy('Original', 'ორიგინალი'), custom: copy('Free', 'თავისუფალი'),
    square: copy('Square 1:1', 'კვადრატი 1:1'), landscape: copy('Landscape', 'ჰორიზონტალური'), portrait: copy('Portrait', 'ვერტიკალური'),
    rotateTool: copy('Rotate', 'შემობრუნება'), flipX: copy('Flip ↔', 'არეკვლა ↔'), unFlipX: copy('Flip ↔', 'არეკვლა ↔'),
    flipY: copy('Flip ↕', 'არეკვლა ↕'), unFlipY: copy('Flip ↕', 'არეკვლა ↕'),
    penTool: copy('Pen', 'კალამი'), arrowTool: copy('Arrow', 'ისარი'), rectangleTool: copy('Box', 'ჩარჩო'), textTool: copy('Text', 'ტექსტი'),
    imageTool: copy('Picture', 'სურათი'), cornerRadius: copy('Corners', 'კუთხეები'),
    stroke: copy('Line', 'ხაზი'), opacity: copy('Opacity', 'გამჭვირვალობა'), transparency: copy('Transparency', 'გამჭვირვალობა'),
    shadow: copy('Shadow', 'ჩრდილი'), position: copy('Position', 'მდებარეობა'), size: copy('Size', 'ზომა'),
    fontFamily: copy('Font', 'შრიფტი'), textSpacings: copy('Spacing', 'დაშორება'), textAlignment: copy('Alignment', 'სწორება'),
    letterSpacing: copy('Letter spacing', 'ასოებს შორის'), lineHeight: copy('Line height', 'ხაზის სიმაღლე'), baselineShift: copy('Baseline shift', 'საბაზისო ხაზის წანაცვლება'),
    invalidTextContent: copy('Write some text first.', 'ჯერ დაწერეთ ტექსტი.'), blur: copy('Blur', 'დაბინდვა'),
    horizontal: copy('Horizontal', 'ჰორიზონტალური'), vertical: copy('Vertical', 'ვერტიკალური'), padding: copy('Padding', 'შიდა დაშორება'),
    width: copy('Width', 'სიგანე'), height: copy('Height', 'სიმაღლე'), px: copy('px', 'px'),
    objectRemovalTool: copy('Blur', 'დაბინდვა'), objectRemovalBrushSize: copy('Brush size', 'ფუნჯის ზომა'),
    objectRemovalBrushMode: copy('Paint over what to hide', 'გადაღებეთ, რაც უნდა დაიმალოს'),
    objectRemovalMarkModeTooltip: copy('Paint', 'ღებვა'), objectRemovalUnMarkModeTooltip: copy('Erase paint', 'საღებავის წაშლა'),
    objectRemovalBrushCircleType: copy('Round brush', 'მრგვალი ფუნჯი'), objectRemovalBrushSquareType: copy('Square brush', 'კვადრატული ფუნჯი'),
    objectRemovalApplyButton: copy('Blur it', 'დაბინდვა'), objectRemovalApplyingText: copy('Blurring…', 'იბინდება…'),
    objectRemovalCancelConfirmationTitle: copy('Stop blurring?', 'შევწყვიტოთ დაბინდვა?'),
    objectRemovalCancelConfirmationHint: copy('The painted area stays as it is in', 'მონიშნული ადგილი რჩება როგორც არის'),
    objectRemovalCancelConfirmationHintCompletion: '', theKeyword: copy('the picture', 'სურათში'),
    imageDimensionsHoverTitle: copy('Size of the saved picture (width × height)', 'შენახული სურათის ზომა (სიგანე × სიმაღლე)'),
    mutualizedFailedToLoadImg: copy('The picture could not load.', 'სურათი ვერ ჩაიტვირთა.'), invalidImageError: copy('The picture could not load.', 'სურათი ვერ ჩაიტვირთა.'),
    tabsMenu: copy('Tools', 'ხელსაწყოები'),
});
