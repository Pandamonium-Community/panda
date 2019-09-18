/**
 * Parse all the tables with a plain border attribute created by TinyMCE and force them to have the similar with via
 * a css border-width atrribute, this is required to override the Enjin default table style setting
 * that has no border, CSS does not allow us to override this with a general style that says "use browser
 * defaults" we have to apply this hack
 */
$(document).ready(function() {
    $(".m_html table[border!=0]").each( function() {
										$(this).css({"border-width": $(this).attr('border')+'px'});
										$(this).find('td').css({"border-color": $(this).css('border-color')});
									});
});